import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type BookingEmailData,
  renderBookingConfirmation,
  renderCancellation,
  renderShopNewBooking,
  sendBookingConfirmation,
} from "./email";

const base: BookingEmailData = {
  to: "kunde@example.com",
  locale: "de",
  customerName: "Max <b>Muster</b>",
  customerPhone: "",
  note: "",
  barberName: "Steven",
  startAt: new Date("2026-11-05T10:00:00Z"), // 11:00 in Berlin
  durationMinutes: 20,
  services: ["Schneiden"],
  totalPriceCents: 1600,
  priceIsFrom: false,
  manageUrl: "https://example.com/booking/abc",
  calendarUrl: "https://example.com/booking/abc/calendar.ics",
  ics: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
  shopPhone: "089 57933371",
  cancelCutoffHours: 2,
  adminUrl: "https://example.com/admin/appointments",
};

describe("renderBookingConfirmation", () => {
  it("German: Berlin time, links, cutoff and escaped name", () => {
    const m = renderBookingConfirmation(base);
    expect(m.subject).toBe("Dein Termin am Donnerstag, 5. November um 11:00 Uhr");
    expect(m.html).toContain("Max &lt;b&gt;Muster&lt;/b&gt;");
    expect(m.html).not.toContain("<b>Muster</b>");
    expect(m.html).toContain(base.manageUrl);
    expect(m.html).toContain(base.calendarUrl);
    expect(m.text).toContain("bis 2 Stunden vorher");
    expect(m.text).toMatch(/16,00\s€/);
  });

  it("English: translated service name and English wording", () => {
    const m = renderBookingConfirmation({ ...base, locale: "en" });
    expect(m.subject).toBe("Your appointment on Thursday 5 November at 11:00");
    expect(m.text).toContain("Haircut");
    expect(m.text).toContain("with Steven");
    expect(m.text).toContain("€16.00");
  });
});

describe("renderShopNewBooking", () => {
  it("includes contact details only when given", () => {
    expect(renderShopNewBooking(base).text).toContain("kunde@example.com");
    expect(renderShopNewBooking({ ...base, customerPhone: "0170 123" }).text).toContain("0170 123");
    expect(renderShopNewBooking(base).subject).toContain("Steven");
  });
});

describe("renderCancellation", () => {
  const c = {
    to: "kunde@example.com",
    locale: "de" as const,
    customerName: "Max",
    barberName: "Steven",
    startAt: base.startAt,
    services: ["Schneiden"],
    bookUrl: "https://example.com/book",
  };
  it("says sorry when the salon cancelled", () => {
    expect(renderCancellation({ ...c, by: "shop" }).text).toContain("leider mussten wir");
    expect(renderCancellation({ ...c, by: "customer" }).text).not.toContain("leider");
  });
});

describe("sendBookingConfirmation without a transport", () => {
  afterEach(() => vi.restoreAllMocks());
  it("logs instead of sending, for both customer and shop", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_URL", "");
    vi.stubEnv("NOTIFY_EMAIL", "owner@example.com");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendBookingConfirmation(base);
    const out = log.mock.calls.map((a) => String(a[0])).join("\n");
    expect(out).toContain("To:      kunde@example.com");
    expect(out).toContain("To:      owner@example.com");
    vi.unstubAllEnvs();
  });

  it("skips the shop alert for bookings the salon entered", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SMTP_URL", "");
    vi.stubEnv("NOTIFY_EMAIL", "owner@example.com");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendBookingConfirmation({ ...base, notifyShop: false });
    expect(log.mock.calls.map((a) => String(a[0])).join("\n")).not.toContain("owner@example.com");
    vi.unstubAllEnvs();
  });
});
