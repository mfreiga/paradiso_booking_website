"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export async function toggleBarberActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const next = formData.get("next") === "true";
  await prisma.stylist.update({ where: { id }, data: { isActive: next } });
  revalidatePath("/admin/barbers");
}

export async function saveBarber(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  // Collect enabled weekdays (1=Mon … 7=Sun) with valid start < end.
  const hours: { stylistId: string; weekday: number; startMinutes: number; endMinutes: number }[] = [];
  for (let wd = 1; wd <= 7; wd++) {
    if (formData.get(`day_${wd}_on`) !== "on") continue;
    const start = toMinutes(String(formData.get(`day_${wd}_start`) ?? ""));
    const end = toMinutes(String(formData.get(`day_${wd}_end`) ?? ""));
    if (start === null || end === null || end <= start) continue;
    hours.push({ stylistId: id, weekday: wd, startMinutes: start, endMinutes: end });
  }

  await prisma.$transaction([
    prisma.stylist.update({
      where: { id },
      data: { name: name || undefined, bio: bio || null },
    }),
    prisma.workingHours.deleteMany({ where: { stylistId: id } }),
    ...(hours.length ? [prisma.workingHours.createMany({ data: hours })] : []),
  ]);

  revalidatePath("/admin/barbers");
}
