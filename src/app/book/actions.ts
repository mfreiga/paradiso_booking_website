"use server";

import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";
import { sendBookingConfirmation } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { BOOKING_LIMITS } from "@/lib/booking-limits";

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
  if (
    !name ||
    name.length > BOOKING_LIMITS.name ||
    email.length > BOOKING_LIMITS.email ||
    !emailRe.test(email) ||
    phone.length > BOOKING_LIMITS.phone ||
    phone.replace(/\D/g, "").length < 6
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
      OR: [{ customerEmail: email }, { customerPhone: phone }],
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

  try {
    const customer = await prisma.customer.upsert({
      where: { email },
      update: { name, phone },
      create: { email, name, phone },
    });

    await prisma.appointment.create({
      data: {
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
      const stylist = await prisma.stylist.findUnique({
        where: { id: input.stylistId },
        select: { name: true },
      });
      await sendBookingConfirmation({
        to: email,
        customerName: name,
        barberName: stylist?.name ?? "",
        startAt: start,
        services: variants.map((v) => v.service.name),
        totalPriceCents,
        priceIsFrom,
        manageUrl: `${siteUrl()}/booking/${manageToken}`,
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
