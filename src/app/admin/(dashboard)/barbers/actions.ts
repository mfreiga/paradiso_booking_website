"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

const PHOTO_MAX_BYTES = 900_000;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Everything that shows a barber: admin, homepage team, booking wizard. */
function refreshAll(id?: string) {
  revalidatePath("/admin/barbers");
  if (id) revalidatePath(`/admin/barbers/${id}`);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/book");
}

function readHours(formData: FormData) {
  const hours: { weekday: number; startMinutes: number; endMinutes: number }[] = [];
  for (let wd = 1; wd <= 7; wd++) {
    if (formData.get(`day_${wd}_on`) !== "on") continue;
    const start = toMinutes(String(formData.get(`day_${wd}_start`) ?? ""));
    const end = toMinutes(String(formData.get(`day_${wd}_end`) ?? ""));
    if (start === null || end === null || end <= start) continue;
    hours.push({ weekday: wd, startMinutes: start, endMinutes: end });
  }
  return hours;
}

/**
 * Creates (no id) or updates a barber: profile, working hours and — when the
 * form includes the services list — which services they offer. A new barber
 * starts with every service for their gender, adjustable on the edit page.
 */
export async function saveBarber(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 300) || null;
  const gender = formData.get("gender") === "FEMALE" ? "FEMALE" : "MALE";
  const hours = readHours(formData);

  if (!name) redirect(id ? `/admin/barbers/${id}?error=name` : "/admin/barbers/new?error=name");

  if (!id) {
    const last = await prisma.stylist.findFirst({ orderBy: { displayOrder: "desc" }, select: { displayOrder: true } });
    const services = await prisma.service.findMany({
      where: { isActive: true, gender: { in: [gender === "MALE" ? "MEN" : "WOMEN", "UNISEX"] } },
      select: { id: true },
    });
    const created = await prisma.stylist.create({
      data: {
        name,
        bio,
        gender,
        displayOrder: (last?.displayOrder ?? 0) + 1,
        workingHours: { create: hours },
        services: { create: services.map((s) => ({ serviceId: s.id })) },
      },
    });
    refreshAll(created.id);
    redirect(`/admin/barbers/${created.id}?created=1`);
  }

  const serviceIds = formData.has("services_present")
    ? formData.getAll("service").map(String)
    : null;

  await prisma.$transaction([
    prisma.stylist.update({ where: { id }, data: { name, bio, gender } }),
    prisma.workingHours.deleteMany({ where: { stylistId: id } }),
    ...(hours.length
      ? [prisma.workingHours.createMany({ data: hours.map((h) => ({ ...h, stylistId: id })) })]
      : []),
    ...(serviceIds
      ? [
          prisma.stylistService.deleteMany({ where: { stylistId: id } }),
          prisma.stylistService.createMany({
            data: serviceIds.map((serviceId) => ({ stylistId: id, serviceId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
  refreshAll(id);
  redirect(`/admin/barbers/${id}?saved=1`);
}

export async function toggleBarberActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const next = formData.get("next") === "true";
  // Deactivating hides the barber, but their booked customers would still come:
  // show those bookings first and only continue on explicit confirmation.
  if (!next && formData.get("confirm") !== "1") {
    const upcoming = await prisma.appointment.count({
      where: { stylistId: id, status: { in: ["PENDING", "CONFIRMED"] }, startAt: { gt: new Date() } },
    });
    if (upcoming > 0) redirect(`/admin/barbers/${id}?warn=${upcoming}`);
  }
  await prisma.stylist.update({ where: { id }, data: { isActive: next } });
  refreshAll(id);
}

/** Moves a barber one position up or down (order on the website and in booking). */
export async function moveBarber(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const all = await prisma.stylist.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = all.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(
    all.map((s, idx) => prisma.stylist.update({ where: { id: s.id }, data: { displayOrder: idx + 1 } })),
  );
  refreshAll();
}

export type PhotoResult = { ok: true } | { ok: false; error: string };

/** Stores a portrait (the browser already resized it to ≤ 800 px JPEG). */
export async function uploadBarberPhoto(formData: FormData): Promise<PhotoResult> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const file = formData.get("photo");
  if (!id || !(file instanceof File)) return { ok: false, error: "Kein Bild ausgewählt." };
  if (!PHOTO_TYPES.includes(file.type)) return { ok: false, error: "Bitte ein JPG-, PNG- oder WebP-Bild wählen." };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "Das Bild ist zu groß." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  await prisma.stylist.update({
    where: { id },
    data: { photoData: bytes, photoMime: file.type, photoUrl: `/stylist-photo/${id}?v=${Date.now()}` },
  });
  refreshAll(id);
  return { ok: true };
}

export async function removeBarberPhoto(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.stylist.update({ where: { id }, data: { photoData: null, photoMime: null, photoUrl: null } });
  refreshAll(id);
}

/** Only for barbers created by mistake — anyone with bookings is deactivated instead. */
export async function deleteBarber(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const used = await prisma.appointment.count({ where: { stylistId: id } });
  if (used > 0) redirect(`/admin/barbers/${id}?error=inuse`);
  await prisma.stylist.delete({ where: { id } });
  refreshAll();
  redirect("/admin/barbers");
}
