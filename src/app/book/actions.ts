"use server";

import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";
import { sendBookingConfirmation } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { BOOKING_LIMITS } from "@/lib/booking-limits";
import { appointmentIcs } from "@/lib/appointment-ics";
import type { Locale } from "@/lib/i18n";

const SHOP_TZ = process.env.SHOP_TIMEZONE ?? "Europe/Berlin";

/** Available start times (ISO strings) for a barber + day + selected variants. */
export async function getSlots(
  stylistId: string,
  date: string,
  variantIds: string[],
): Promise<string[]> {
  if (!stylistId || !date || variantIds.length === 0) return [];
  const variants = await prisma.serviceVariant.findMany({
    where: { id: { in: variantIds } },
    select: { durationMinutes: true },
  });
  const durationMinutes = variants.reduce((s, v) => s + v.durationMinutes, 0);
  if (durationMinutes <= 0) return [];
  const slots = await getAvailableSlots({ stylistId, date, durationMinutes });
  return slots.map((d) => d.toISOString());
}

/**
 * "No preference": free start times across every barber who offers all the
 * selected services. Each time goes to the least busy barber that day (the
 * one with the most free slots), which spreads bookings across the team.
 */
export async function getAnySlots(
  date: string,
  variantIds: string[],
): Promise<{ startAt: string; stylistId: string }[]> {
  if (!date || variantIds.length === 0) return [];
  const variants = await prisma.serviceVariant.findMany({
    where: { id: { in: variantIds } },
    select: { durationMinutes: true, serviceId: true },
  });
  const durationMinutes = variants.reduce((s, v) => s + v.durationMinutes, 0);
  if (durationMinutes <= 0 || variants.length !== variantIds.length) return [];
  const serviceIds = [...new Set(variants.map((v) => v.serviceId))];
  const stylists = await prisma.stylist.findMany({
    where: { isActive: true, AND: serviceIds.map((serviceId) => ({ services: { some: { serviceId } } })) },
    select: { id: true },
  });
  const perStylist = await Promise.all(
    stylists.map(async (s) => ({
      stylistId: s.id,
      slots: await getAvailableSlots({ stylistId: s.id, date, durationMinutes }),
    })),
  );
  // Least busy first, so they win ties for the same start time.
  perStylist.sort((a, b) => b.slots.length - a.slots.length);
  const byTime = new Map<number, string>();
  for (const { stylistId, slots } of perStylist) {
    for (const d of slots) if (!byTime.has(d.getTime())) byTime.set(d.getTime(), stylistId);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, stylistId]) => ({ startAt: new Date(t).toISOString(), stylistId }));
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
        adminUrl: `${siteUrl()}/admin/appointments/${appt.id}`,
      });
    } catch (e) {
      console.error("confirmation email failed:", e);
    }

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
