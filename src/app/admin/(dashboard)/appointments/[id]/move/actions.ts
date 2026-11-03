"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import { moveAppointment, moveOpenDays, moveSlots, type MoveError } from "@/lib/reschedule";

// The salon may pick another barber and isn't bound by the online lead time.
export async function adminMoveDays(appointmentId: string, stylistId: string, month: string): Promise<string[]> {
  await requireAdmin();
  return moveOpenDays(appointmentId, stylistId, month, true);
}

export async function adminMoveSlots(appointmentId: string, stylistId: string, date: string): Promise<string[]> {
  await requireAdmin();
  return moveSlots(appointmentId, stylistId, date, true);
}

export async function adminMove(
  appointmentId: string,
  stylistId: string,
  startAt: string,
): Promise<{ ok: true } | { ok: false; error: MoveError }> {
  await requireAdmin();
  const res = await moveAppointment({ appointmentId, stylistId, startAt, by: "shop" });
  if (res.ok) {
    revalidatePath("/admin/appointments");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin");
  }
  return res;
}
