"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { sendCancellation } from "@/lib/email";
import { notifyStaff } from "@/lib/push";
import { siteUrl } from "@/lib/site-url";
import { moveAppointment, moveOpenDays, moveSlots, type MoveError } from "@/lib/reschedule";

async function byToken(token: string) {
  if (!token) return null;
  return prisma.appointment.findUnique({ where: { manageToken: token }, select: { id: true, stylistId: true } });
}

export async function cancelBooking(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) return;

  const appt = await prisma.appointment.findUnique({
    where: { manageToken: token },
    include: { stylist: { select: { name: true } }, items: { select: { nameSnapshot: true } } },
  });
  if (!appt) return;
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") return;

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const cutoffMin = setting?.cancellationCutoffMin ?? 120;
  // Too close to the appointment to cancel online.
  if (appt.startAt.getTime() - Date.now() <= cutoffMin * 60_000) return;

  await prisma.appointment.update({
    where: { manageToken: token },
    data: { status: "CANCELLED" },
  });

  try {
    await sendCancellation({
      to: appt.customerEmail,
      locale: appt.locale === "en" ? "en" : "de",
      customerName: appt.customerName,
      barberName: appt.stylist.name,
      startAt: appt.startAt,
      services: appt.items.map((i) => i.nameSnapshot),
      bookUrl: `${siteUrl()}/book`,
      by: "customer",
    });
  } catch (e) {
    console.error("cancellation email failed:", e);
  }
  const when = DateTime.fromJSDate(appt.startAt).setZone("Europe/Berlin").setLocale("de").toFormat("ccc dd.MM., HH:mm");
  await notifyStaff(
    { title: `Abgesagt: ${when}`, body: `${appt.customerName} · ${appt.stylist.name} · Die Zeit ist wieder frei.` },
    { stylistIds: [appt.stylistId] },
  );

  revalidatePath(`/booking/${token}`);
  revalidatePath("/admin/appointments");
  revalidatePath("/admin");
}

// ── moving (same barber, same services; customer lead time applies) ────────
// The barber argument keeps the signature shared with the admin version; the
// customer can never change barber, so it is ignored and taken from the booking.
export async function getMoveDays(token: string, _stylistId: string, month: string): Promise<string[]> {
  const a = await byToken(token);
  return a ? moveOpenDays(a.id, a.stylistId, month, false) : [];
}

export async function getMoveSlots(token: string, _stylistId: string, date: string): Promise<string[]> {
  const a = await byToken(token);
  return a ? moveSlots(a.id, a.stylistId, date, false) : [];
}

export async function moveBooking(token: string, _stylistId: string, startAt: string): Promise<{ ok: true } | { ok: false; error: MoveError }> {
  const a = await byToken(token);
  if (!a) return { ok: false, error: "notFound" };
  const res = await moveAppointment({ appointmentId: a.id, stylistId: a.stylistId, startAt, by: "customer" });
  if (res.ok) {
    revalidatePath(`/booking/${token}`);
    revalidatePath("/admin/appointments");
    revalidatePath("/admin");
  }
  return res;
}
