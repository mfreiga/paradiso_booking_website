import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { computeSlotsForDay, type Interval } from "@/lib/slots";

export interface AvailabilityOptions {
  stylistId: string;
  /** "YYYY-MM-DD", interpreted in the shop timezone. */
  date: string;
  /** Total duration of the selected service(s) in minutes. */
  durationMinutes: number;
  /** Defaults to the current time (overridable for testing). */
  now?: Date;
  /** Admin manual entry: skip the minimum-lead-time filter. */
  ignoreLeadTime?: boolean;
}

/**
 * Computes the bookable start times for one barber on one day, as UTC Dates.
 * Reads settings, working hours, existing appointments and time off, then
 * delegates the math to the pure {@link computeSlotsForDay}.
 */
export async function getAvailableSlots(
  opts: AvailabilityOptions,
): Promise<Date[]> {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const tz = setting?.timezone ?? "Europe/Berlin";
  const granularity = setting?.slotGranularityMin ?? 15;
  const buffer = setting?.defaultBufferMin ?? 0;
  const leadMin = setting?.minLeadTimeMin ?? 120;
  const windowDays = setting?.bookingWindowDays ?? 60;

  const now = opts.now ?? new Date();
  const nowZ = DateTime.fromJSDate(now).setZone(tz);
  const dayStart = DateTime.fromISO(opts.date, { zone: tz }).startOf("day");
  if (!dayStart.isValid || opts.durationMinutes <= 0) return [];

  // Booking-window bounds.
  if (dayStart < nowZ.startOf("day")) return [];
  if (dayStart > nowZ.startOf("day").plus({ days: windowDays })) return [];

  const weekday = dayStart.weekday; // 1=Mon … 7=Sun

  const workingHours = await prisma.workingHours.findMany({
    where: { stylistId: opts.stylistId, weekday },
  });
  if (workingHours.length === 0) return [];
  const workingWindows: Interval[] = workingHours.map((w) => ({
    start: w.startMinutes,
    end: w.endMinutes,
  }));

  const dayStartUTC = dayStart.toUTC().toJSDate();
  const dayEndUTC = dayStart.plus({ days: 1 }).toUTC().toJSDate();

  const [appts, offs] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        stylistId: opts.stylistId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { lt: dayEndUTC },
        endAt: { gt: dayStartUTC },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.timeOff.findMany({
      where: {
        stylistId: opts.stylistId,
        startAt: { lt: dayEndUTC },
        endAt: { gt: dayStartUTC },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const wallMinute = (d: Date) => {
    const z = DateTime.fromJSDate(d).setZone(tz);
    return z.hour * 60 + z.minute;
  };
  const sameDay = (d: Date) =>
    DateTime.fromJSDate(d).setZone(tz).hasSame(dayStart, "day");

  const busy: Interval[] = [...appts, ...offs]
    .map((x) => ({
      start: sameDay(x.startAt) ? wallMinute(x.startAt) : 0,
      end: sameDay(x.endAt) ? wallMinute(x.endAt) : 1440,
    }))
    .filter((i) => i.end > i.start);

  // Lead time only constrains the current day.
  let earliest = Number.NEGATIVE_INFINITY;
  if (dayStart.hasSame(nowZ, "day")) {
    const e = nowZ.plus({ minutes: opts.ignoreLeadTime ? 0 : leadMin });
    earliest = e.hasSame(dayStart, "day")
      ? e.hour * 60 + e.minute
      : Number.POSITIVE_INFINITY;
  }

  const startMinutes = computeSlotsForDay({
    workingWindows,
    busy,
    durationMinutes: opts.durationMinutes,
    slotGranularityMinutes: granularity,
    bufferMinutes: buffer,
    earliestStartMinute: earliest,
  });

  return startMinutes.map((m) =>
    dayStart.set({ hour: Math.floor(m / 60), minute: m % 60 }).toUTC().toJSDate(),
  );
}
