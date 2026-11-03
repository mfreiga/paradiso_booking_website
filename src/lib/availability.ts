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
  /** When moving a booking, its own current slot must not count as busy. */
  excludeAppointmentId?: string;
}

export interface RangeOptions extends Omit<AvailabilityOptions, "date"> {
  /** First and last day ("YYYY-MM-DD", inclusive), in the shop timezone. */
  from: string;
  to: string;
}

/**
 * Bookable start times (UTC Dates) for one barber on every day of a range.
 * Loads settings, working hours, appointments and time off once for the whole
 * range, then delegates the per-day math to the pure {@link computeSlotsForDay}.
 * Days outside the booking window (or with no free slot) map to an empty list.
 */
export async function getAvailabilityRange(opts: RangeOptions): Promise<Map<string, Date[]>> {
  const result = new Map<string, Date[]>();
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const tz = setting?.timezone ?? "Europe/Berlin";
  const granularity = setting?.slotGranularityMin ?? 15;
  const buffer = setting?.defaultBufferMin ?? 0;
  const leadMin = setting?.minLeadTimeMin ?? 120;
  const windowDays = setting?.bookingWindowDays ?? 60;

  const now = opts.now ?? new Date();
  const nowZ = DateTime.fromJSDate(now).setZone(tz);
  const first = DateTime.fromISO(opts.from, { zone: tz }).startOf("day");
  const last = DateTime.fromISO(opts.to, { zone: tz }).startOf("day");
  if (!first.isValid || !last.isValid || opts.durationMinutes <= 0 || last < first) return result;

  // Clamp to the booking window.
  const windowStart = nowZ.startOf("day");
  const windowEnd = windowStart.plus({ days: windowDays });
  const from = DateTime.max(first, windowStart);
  const to = DateTime.min(last, windowEnd);
  for (let d = first; d <= last; d = d.plus({ days: 1 })) result.set(d.toISODate()!, []);
  if (to < from) return result;

  const rangeStartUTC = from.toUTC().toJSDate();
  const rangeEndUTC = to.plus({ days: 1 }).toUTC().toJSDate();
  const [workingHours, appts, offs] = await Promise.all([
    prisma.workingHours.findMany({ where: { stylistId: opts.stylistId } }),
    prisma.appointment.findMany({
      where: {
        stylistId: opts.stylistId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startAt: { lt: rangeEndUTC },
        endAt: { gt: rangeStartUTC },
        ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.timeOff.findMany({
      where: { stylistId: opts.stylistId, startAt: { lt: rangeEndUTC }, endAt: { gt: rangeStartUTC } },
      select: { startAt: true, endAt: true },
    }),
  ]);
  const blocks = [...appts, ...offs];

  for (let dayStart = from; dayStart <= to; dayStart = dayStart.plus({ days: 1 })) {
    const windows: Interval[] = workingHours
      .filter((w) => w.weekday === dayStart.weekday)
      .map((w) => ({ start: w.startMinutes, end: w.endMinutes }));
    if (windows.length === 0) continue;

    const wallMinute = (d: Date) => {
      const z = DateTime.fromJSDate(d).setZone(tz);
      return z.hour * 60 + z.minute;
    };
    const sameDay = (d: Date) => DateTime.fromJSDate(d).setZone(tz).hasSame(dayStart, "day");
    const dayEnd = dayStart.plus({ days: 1 });
    const busy: Interval[] = blocks
      .filter((x) => x.startAt < dayEnd.toJSDate() && x.endAt > dayStart.toJSDate())
      .map((x) => ({
        start: sameDay(x.startAt) ? wallMinute(x.startAt) : 0,
        end: sameDay(x.endAt) ? wallMinute(x.endAt) : 1440,
      }))
      .filter((i) => i.end > i.start);

    // Lead time only constrains the current day.
    let earliest = Number.NEGATIVE_INFINITY;
    if (dayStart.hasSame(nowZ, "day")) {
      const e = nowZ.plus({ minutes: opts.ignoreLeadTime ? 0 : leadMin });
      earliest = e.hasSame(dayStart, "day") ? e.hour * 60 + e.minute : Number.POSITIVE_INFINITY;
    }

    const startMinutes = computeSlotsForDay({
      workingWindows: windows,
      busy,
      durationMinutes: opts.durationMinutes,
      slotGranularityMinutes: granularity,
      bufferMinutes: buffer,
      earliestStartMinute: earliest,
    });
    result.set(
      dayStart.toISODate()!,
      startMinutes.map((m) => dayStart.set({ hour: Math.floor(m / 60), minute: m % 60 }).toUTC().toJSDate()),
    );
  }
  return result;
}

/** Bookable start times for one barber on one day, as UTC Dates. */
export async function getAvailableSlots(opts: AvailabilityOptions): Promise<Date[]> {
  const { date, ...rest } = opts;
  const range = await getAvailabilityRange({ ...rest, from: date, to: date });
  return range.get(date) ?? [];
}
