"use server";

import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getAvailabilityRange, getAvailableSlots } from "@/lib/availability";
import { emailTransport, sendBookingConfirmation } from "@/lib/email";
import { notifyStaff } from "@/lib/push";
import { siteUrl } from "@/lib/site-url";
import { BOOKING_LIMITS } from "@/lib/booking-limits";
import { appointmentIcs } from "@/lib/appointment-ics";
import type { Locale } from "@/lib/i18n";

const SHOP_TZ = process.env.SHOP_TIMEZONE ?? "Europe/Berlin";

async function durationOf(variantIds: string[]): Promise<number> {
  if (!Array.isArray(variantIds) || variantIds.length === 0 || variantIds.length > 20) return 0;
  const variants = await prisma.serviceVariant.findMany({
    where: { id: { in: variantIds } },
    select: { durationMinutes: true },
  });
  return variants.reduce((s, v) => s + v.durationMinutes, 0);
}

/** Only active barbers, max. 10 — these actions are public endpoints. */
async function activeIds(stylistIds: string[]): Promise<string[]> {
  if (!Array.isArray(stylistIds) || stylistIds.length === 0) return [];
  const rows = await prisma.stylist.findMany({
    where: { id: { in: stylistIds.slice(0, 10) }, isActive: true },
    select: { id: true },
  });
  const ok = new Set(rows.map((r) => r.id));
  return stylistIds.filter((id) => ok.has(id)); // keep the caller's (display) order
}

/** Available start times (ISO strings) for a barber + day + selected variants. */
export async function getSlots(
  stylistId: string,
  date: string,
  variantIds: string[],
): Promise<string[]> {
  if (!stylistId || !date) return [];
  const durationMinutes = await durationOf(variantIds);
  if (durationMinutes <= 0) return [];
  const slots = await getAvailableSlots({ stylistId, date, durationMinutes });
  return slots.map((d) => d.toISOString());
}

/**
 * Free start times across several barbers ("no preference"). Each time is
 * assigned to the first barber (in the given order) who is free then.
 */
export async function getSlotsAny(
  stylistIds: string[],
  date: string,
  variantIds: string[],
): Promise<{ iso: string; stylistId: string }[]> {
  const [ids, durationMinutes] = await Promise.all([activeIds(stylistIds), durationOf(variantIds)]);
  if (!date || ids.length === 0 || durationMinutes <= 0) return [];
  const perBarber = await Promise.all(ids.map((stylistId) => getAvailableSlots({ stylistId, date, durationMinutes })));
  const byTime = new Map<string, string>();
  perBarber.forEach((slots, i) => {
    for (const d of slots) if (!byTime.has(d.toISOString())) byTime.set(d.toISOString(), ids[i]);
  });
  return [...byTime.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([iso, stylistId]) => ({ iso, stylistId }));
}

/** Days ("YYYY-MM-DD") in a month on which at least one of the barbers has a free slot. */
export async function getOpenDays(
  stylistIds: string[],
  month: string,
  variantIds: string[],
): Promise<string[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const [ids, durationMinutes] = await Promise.all([activeIds(stylistIds), durationOf(variantIds)]);
  if (ids.length === 0 || durationMinutes <= 0) return [];
  const start = DateTime.fromISO(`${month}-01`, { zone: SHOP_TZ });
  const from = start.toISODate()!;
  const to = start.endOf("month").toISODate()!;
  const ranges = await Promise.all(ids.map((stylistId) => getAvailabilityRange({ stylistId, from, to, durationMinutes })));
  const open = new Set<string>();
  for (const r of ranges) for (const [day, slots] of r) if (slots.length > 0) open.add(day);
  return [...open].sort();
}

export interface CreateBookingInput {
  stylistId: string;
  variantIds: string[];
  startAt: string; // ISO
  name: string;
  email: string;
  phone: string;
  note?: string;
  /** Honeypot: hidden from people, filled in by naive bots. Must stay empty. */
  website?: string;
  /** Site language, so emails go out in the customer's language. */
  locale?: string;
}

/** Error codes are translated in the booking wizard (see i18n `book.errors`). */
export type BookingErrorCode =
  | "incomplete"
  | "invalidContact"
  | "serviceNotFound"
  | "comboUnavailable"
  | "invalidTime"
  | "slotUnavailable"
  | "slotTaken"
  | "tooMany"
  | "failed";

export type CreateBookingResult =
  | { ok: true; manageToken: string }
  | { ok: false; error: BookingErrorCode };

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Bookings are confirmed instantly without verification, so cap how many
// upcoming appointments one email/phone can hold (a family booking for kids
// still fits) to stop a single person or script from filling the calendar.
const MAX_ACTIVE_PER_CONTACT = 3;

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim();
  const note = (input.note ?? "").trim().slice(0, BOOKING_LIMITS.note);
  const variantIds = Array.isArray(input.variantIds) ? input.variantIds : [];

  if (input.website) return { ok: false, error: "failed" };
  if (!input.stylistId || variantIds.length === 0 || !input.startAt) {
    return { ok: false, error: "incomplete" };
  }
  // Phone is optional; if given it has to look like a number.
  if (
    !name ||
    name.length > BOOKING_LIMITS.name ||
    email.length > BOOKING_LIMITS.email ||
    !emailRe.test(email) ||
    phone.length > BOOKING_LIMITS.phone ||
    (phone && phone.replace(/\D/g, "").length < 6)
  ) {
    return { ok: false, error: "invalidContact" };
  }

  // Recompute everything from the DB — never trust client prices/durations.
  const [variants, stylist] = await Promise.all([
    prisma.serviceVariant.findMany({
      where: { id: { in: variantIds } },
      include: { service: { select: { id: true, name: true, isActive: true } } },
    }),
    prisma.stylist.findUnique({
      where: { id: input.stylistId },
      select: { isActive: true, services: { select: { serviceId: true } } },
    }),
  ]);
  if (variants.length !== variantIds.length || variants.some((v) => !v.service.isActive)) {
    return { ok: false, error: "serviceNotFound" };
  }
  // The wizard only offers qualified barbers, but the action is a public
  // endpoint: re-check that this barber is active and offers every service.
  const offeredServiceIds = new Set(stylist?.services.map((s) => s.serviceId));
  if (!stylist?.isActive || variants.some((v) => !offeredServiceIds.has(v.service.id))) {
    return { ok: false, error: "comboUnavailable" };
  }

  const activeForContact = await prisma.appointment.count({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gt: new Date() },
      OR: [{ customerEmail: email }, ...(phone ? [{ customerPhone: phone }] : [])],
    },
  });
  if (activeForContact >= MAX_ACTIVE_PER_CONTACT) {
    return { ok: false, error: "tooMany" };
  }
  const totalDurationMinutes = variants.reduce((s, v) => s + v.durationMinutes, 0);
  const totalPriceCents = variants.reduce((s, v) => s + v.priceCents, 0);
  const priceIsFrom = variants.some(
    (v) => v.priceType === "FROM" || v.priceType === "ON_REQUEST",
  );

  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "invalidTime" };
  }
  const end = new Date(start.getTime() + totalDurationMinutes * 60_000);

  // Re-validate the slot is actually offered (working hours, lead time, not taken).
  const dateStr = DateTime.fromJSDate(start).setZone(SHOP_TZ).toISODate();
  if (!dateStr) return { ok: false, error: "invalidTime" };
  const offered = await getAvailableSlots({
    stylistId: input.stylistId,
    date: dateStr,
    durationMinutes: totalDurationMinutes,
  });
  if (!offered.some((d) => d.getTime() === start.getTime())) {
    return { ok: false, error: "slotUnavailable" };
  }

  const manageToken = randomBytes(24).toString("hex");
  const reviewToken = randomBytes(24).toString("hex");
  const locale: Locale = input.locale === "en" ? "en" : "de";

  try {
    const customer = await prisma.customer.upsert({
      where: { email },
      update: { name, ...(phone ? { phone } : {}) },
      create: { email, name, phone: phone || null },
    });

    const appt = await prisma.appointment.create({
      data: {
        locale,
        stylistId: input.stylistId,
        customerId: customer.id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        startAt: start,
        endAt: end,
        status: "CONFIRMED",
        totalPriceCents,
        totalDurationMinutes,
        priceIsFrom,
        customerNote: note || null,
        manageToken,
        reviewToken,
        source: "CUSTOMER",
        items: {
          create: variants.map((v) => ({
            serviceId: v.service.id,
            serviceVariantId: v.id,
            nameSnapshot: v.service.name,
            variantLabelSnapshot: v.label,
            priceCentsSnapshot: v.priceCents,
            durationMinutesSnapshot: v.durationMinutes,
          })),
        },
      },
    });

    try {
      const [stylistRow, setting] = await Promise.all([
        prisma.stylist.findUnique({ where: { id: input.stylistId }, select: { name: true } }),
        prisma.setting.findUnique({ where: { id: 1 } }),
      ]);
      const barberName = stylistRow?.name ?? "";
      const manageUrl = `${siteUrl()}/booking/${manageToken}`;
      const services = variants.map((v) => v.service.name);
      await sendBookingConfirmation({
        to: email,
        locale,
        customerName: name,
        customerPhone: phone,
        note,
        barberName,
        startAt: start,
        durationMinutes: totalDurationMinutes,
        services,
        totalPriceCents,
        priceIsFrom,
        manageUrl,
        calendarUrl: `${manageUrl}/calendar.ics`,
        ics: appointmentIcs({
          id: appt.id,
          startAt: start,
          endAt: end,
          stylistName: barberName,
          services,
          manageUrl,
          locale,
          address: setting?.shopAddress,
        }),
        shopPhone: setting?.shopPhone ?? "089 57933371",
        cancelCutoffHours: Math.round((setting?.cancellationCutoffMin ?? 120) / 60),
        adminUrl: `${siteUrl()}/admin/appointments`,
      });
      // Only a real send counts (the dashboard flags bookings without one).
      if (emailTransport() !== "log") {
        await prisma.appointment.update({ where: { id: appt.id }, data: { confirmationSentAt: new Date() } });
      }
    } catch (e) {
      console.error("confirmation email failed:", e);
    }

    const when = DateTime.fromJSDate(start).setZone(SHOP_TZ).setLocale("de").toFormat("ccc dd.MM., HH:mm");
    const barberName = (await prisma.stylist.findUnique({ where: { id: input.stylistId }, select: { name: true } }))?.name ?? "";
    await notifyStaff(
      {
        title: `Neue Buchung: ${when}`,
        body: `${name} · ${barberName} · ${variants.map((v) => v.service.name).join(", ")}`,
        url: `/admin/calendar?view=day&date=${dateStr}`,
      },
      { stylistIds: [input.stylistId] }, // the owner + this booking's barber
    );

    return { ok: true, manageToken };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("no_overlap") || msg.includes("23P01") || msg.includes("exclusion")) {
      return { ok: false, error: "slotTaken" };
    }
    console.error("createBooking failed:", e);
    return { ok: false, error: "failed" };
  }
}
