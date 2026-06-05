// Pure slot-computation logic — no DB, no timezones (see SPEC §8).
// All times are integer minutes from midnight within the shop's local day.

export interface Interval {
  start: number; // inclusive
  end: number; // exclusive
}

/** Merge overlapping/adjacent intervals into sorted, non-overlapping ones. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && it.start <= last.end) {
      last.end = Math.max(last.end, it.end);
    } else {
      out.push({ ...it });
    }
  }
  return out;
}

/** Subtract busy intervals from a single window; returns free sub-windows. */
export function subtractIntervals(window: Interval, busy: Interval[]): Interval[] {
  const merged = mergeIntervals(busy);
  const free: Interval[] = [];
  let cursor = window.start;
  for (const b of merged) {
    if (b.end <= cursor || b.start >= window.end) continue;
    if (b.start > cursor) {
      free.push({ start: cursor, end: Math.min(b.start, window.end) });
    }
    cursor = Math.max(cursor, b.end);
    if (cursor >= window.end) break;
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return free;
}

export interface ComputeSlotsInput {
  /** Working windows for the day, e.g. [{ start: 540, end: 1080 }] (09:00–18:00). */
  workingWindows: Interval[];
  /** Existing appointments + time off (shop-local minutes). */
  busy: Interval[];
  /** Total appointment duration in minutes. */
  durationMinutes: number;
  /** Offered start times are aligned to this grid (e.g. 15). */
  slotGranularityMinutes: number;
  /** Cleanup buffer added around each existing appointment. */
  bufferMinutes?: number;
  /** Inclusive lower bound for start time (e.g. lead time on the current day). */
  earliestStartMinute?: number;
  /** Inclusive upper bound for start time. */
  latestStartMinute?: number;
}

/**
 * Returns sorted candidate start minutes (clock-aligned to the grid) where a
 * block of `durationMinutes` fits entirely within a free part of a working window.
 */
export function computeSlotsForDay(input: ComputeSlotsInput): number[] {
  const {
    workingWindows,
    busy,
    durationMinutes,
    slotGranularityMinutes: g,
    bufferMinutes = 0,
    earliestStartMinute = Number.NEGATIVE_INFINITY,
    latestStartMinute = Number.POSITIVE_INFINITY,
  } = input;

  if (durationMinutes <= 0 || g <= 0) return [];

  // Expand busy by the buffer on both sides so new appointments keep their distance.
  const expandedBusy = busy.map((b) => ({
    start: b.start - bufferMinutes,
    end: b.end + bufferMinutes,
  }));

  const starts: number[] = [];
  for (const win of mergeIntervals(workingWindows)) {
    for (const free of subtractIntervals(win, expandedBusy)) {
      const lower = Math.max(free.start, earliestStartMinute);
      // First grid-aligned time at or after `lower`.
      let t = Math.ceil(lower / g) * g;
      for (; t + durationMinutes <= free.end && t <= latestStartMinute; t += g) {
        starts.push(t);
      }
    }
  }
  return [...new Set(starts)].sort((a, b) => a - b);
}
