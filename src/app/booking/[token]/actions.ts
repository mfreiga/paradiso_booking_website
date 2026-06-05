"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function cancelBooking(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) return;

  const appt = await prisma.appointment.findUnique({ where: { manageToken: token } });
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
  revalidatePath(`/booking/${token}`);
  revalidatePath("/admin/appointments");
  revalidatePath("/admin");
}
