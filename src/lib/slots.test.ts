import { describe, it, expect } from "vitest";
import { mergeIntervals, subtractIntervals, computeSlotsForDay } from "./slots";

describe("mergeIntervals", () => {
  it("merges overlapping and adjacent intervals", () => {
    expect(
      mergeIntervals([
        { start: 0, end: 10 },
        { start: 5, end: 15 },
        { start: 15, end: 20 },
        { start: 30, end: 40 },
      ]),
    ).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
  });

  it("drops empty intervals", () => {
    expect(mergeIntervals([{ start: 5, end: 5 }])).toEqual([]);
  });
});

describe("subtractIntervals", () => {
  it("removes a middle busy block", () => {
    expect(
      subtractIntervals({ start: 540, end: 1080 }, [{ start: 600, end: 660 }]),
    ).toEqual([
      { start: 540, end: 600 },
      { start: 660, end: 1080 },
    ]);
  });

  it("returns the whole window when nothing is busy", () => {
    expect(subtractIntervals({ start: 540, end: 600 }, [])).toEqual([
      { start: 540, end: 600 },
    ]);
  });
});

describe("computeSlotsForDay", () => {
  // 09:00–11:00 window, 30-min service, 15-min grid.
  const base = {
    workingWindows: [{ start: 540, end: 660 }],
    busy: [],
    durationMinutes: 30,
    slotGranularityMinutes: 15,
  };

  it("fills an empty window on the grid", () => {
    expect(computeSlotsForDay(base)).toEqual([540, 555, 570, 585, 600, 615, 630]);
  });

  it("excludes times blocked by an appointment", () => {
    expect(
      computeSlotsForDay({ ...base, busy: [{ start: 600, end: 630 }] }),
    ).toEqual([540, 555, 570, 630]);
  });

  it("applies a cleanup buffer around appointments", () => {
    expect(
      computeSlotsForDay({
        ...base,
        busy: [{ start: 600, end: 630 }],
        bufferMinutes: 15,
      }),
    ).toEqual([540, 555]);
  });

  it("respects the earliest start (lead time)", () => {
    expect(
      computeSlotsForDay({ ...base, earliestStartMinute: 600 }),
    ).toEqual([600, 615, 630]);
  });

  it("returns nothing when the service is longer than any free window", () => {
    expect(computeSlotsForDay({ ...base, durationMinutes: 200 })).toEqual([]);
  });

  it("a longer service yields fewer slots than a short one (core mechanic)", () => {
    const short = computeSlotsForDay({ ...base, durationMinutes: 15 });
    const long = computeSlotsForDay({ ...base, durationMinutes: 90 });
    expect(long.length).toBeLessThan(short.length);
    expect(long).toEqual([540, 555, 570]); // 90-min must end by 11:00
  });

  it("handles split working windows (e.g. lunch break)", () => {
    expect(
      computeSlotsForDay({
        ...base,
        workingWindows: [
          { start: 540, end: 600 }, // 09:00–10:00
          { start: 660, end: 720 }, // 11:00–12:00
        ],
      }),
    ).toEqual([540, 555, 570, 660, 675, 690]);
  });
});
