"use server";

import { revalidatePath } from "next/cache";
import { allowedStylist, requireAppointmentAccess } from "@/lib/auth-guard";
import { moveAppointment, moveOpenDays, moveSlots, type MoveError } from "@/lib/reschedule";

// The salon may pick another barber and isn't bound by the online lead time.
// Barbers may only move their own appointments, and only within their own column.
async function guard(appointmentId: string, stylistId: string) {
  const { staff } = await requireAppointmentAccess(appointmentId);
  return allowedStylist(staff, stylistId);
}

export async function adminMoveDays(appointmentId: string, stylistId: string, month: string): Promise<string[]> {
  const sid = await guard(appointmentId, stylistId);
  return sid ? moveOpenDays(appointmentId, sid, month, true) : [];
}

export async function adminMoveSlots(appointmentId: string, stylistId: string, date: string): Promise<string[]> {
  const sid = await guard(appointmentId, stylistId);
  return sid ? moveSlots(appointmentId, sid, date, true) : [];
}

export async function adminMove(
  appointmentId: string,
  stylistId: string,
  startAt: string,
): Promise<{ ok: true } | { ok: false; error: MoveError }> {
  const sid = await guard(appointmentId, stylistId);
  if (!sid) return { ok: false, error: "combo" };
  const res = await moveAppointment({ appointmentId, stylistId: sid, startAt, by: "shop" });
  if (res.ok) {
    revalidatePath("/admin/appointments");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin");
  }
  return res;
}
