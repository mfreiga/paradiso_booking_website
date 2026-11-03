"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

const TZ = "Europe/Berlin";
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;
const MAX_DAYS = 366;

function fail(code: "date" | "time" | "range" | "barber"): never {
  redirect(`/admin/time-off?error=${code}`);
}

function refresh() {
  revalidatePath("/admin/time-off");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
}

/**
 * Blocks a barber (or every active barber) from online booking. Without
 * times the range covers whole days, from the start of `fromDate` to the end
 * of `toDate`; with times it runs continuously from `fromDate fromTime` to
 * `toDate toTime` (e.g. a phone booking 15:00–15:30, or Mon 14:00 – Wed 12:00).
 */
export async function createTimeOff(formData: FormData) {
  await requireAdmin();
  const stylistId = String(formData.get("stylistId") ?? "");
  const fromDate = String(formData.get("fromDate") ?? "");
  const toDate = String(formData.get("toDate") ?? "") || fromDate;
  const fromTime = String(formData.get("fromTime") ?? "");
  const toTime = String(formData.get("toTime") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 100) || null;

  if (!dateRe.test(fromDate) || !dateRe.test(toDate)) fail("date");
  if ((fromTime && !timeRe.test(fromTime)) || (toTime && !timeRe.test(toTime))) fail("time");

  const start = DateTime.fromISO(`${fromDate}T${fromTime || "00:00"}`, { zone: TZ });
  const end = toTime
    ? DateTime.fromISO(`${toDate}T${toTime}`, { zone: TZ })
    : DateTime.fromISO(toDate, { zone: TZ }).plus({ days: 1 }).startOf("day");
  if (!start.isValid || !end.isValid) fail("date");
  if (end <= start || end.diff(start, "days").days > MAX_DAYS) fail("range");

  const stylistIds =
    stylistId === "ALL"
      ? (await prisma.stylist.findMany({ where: { isActive: true }, select: { id: true } })).map((s) => s.id)
      : (await prisma.stylist.findUnique({ where: { id: stylistId }, select: { id: true } }))
        ? [stylistId]
        : [];
  if (stylistIds.length === 0) fail("barber");

  await prisma.timeOff.createMany({
    data: stylistIds.map((id) => ({
      stylistId: id,
      startAt: start.toUTC().toJSDate(),
      endAt: end.toUTC().toJSDate(),
      reason,
    })),
  });
  refresh();
  redirect("/admin/time-off?saved=1");
}

/** Deletes one grouped entry (comma-separated ids — "all barbers" rows are listed together). */
export async function deleteTimeOff(formData: FormData) {
  await requireAdmin();
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return;
  await prisma.timeOff.deleteMany({ where: { id: { in: ids } } });
  refresh();
}
