import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "./ics";

describe("escapeText", () => {
  it("escapes the RFC 5545 special characters", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Haircut")).toBe("SUMMARY:Haircut");
  });

  it("keeps every physical line within 75 octets, counting multi-byte characters", () => {
    const folded = foldLine("DESCRIPTION:" + "ä".repeat(100));
    const enc = new TextEncoder();
    for (const l of folded.split("\r\n")) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "ä".repeat(100));
  });
});

describe("buildIcs", () => {
  const ics = buildIcs({
    uid: "abc@paradiso",
    start: new Date("2026-11-04T10:15:00Z"),
    end: new Date("2026-11-04T10:45:00Z"),
    title: "Friseurtermin, Paradiso",
    location: "Augustenstraße 72, 80333 München",
    alarmMinutesBefore: 120,
    now: new Date("2026-11-03T12:00:00Z"),
  });

  it("writes UTC times and CRLF line endings", () => {
    expect(ics).toContain("DTSTART:20261104T101500Z\r\n");
    expect(ics).toContain("DTEND:20261104T104500Z\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes text values and adds the reminder", () => {
    expect(ics).toContain("SUMMARY:Friseurtermin\\, Paradiso");
    expect(ics).toContain("TRIGGER:-PT120M");
  });
});
