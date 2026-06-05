"use server";

import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";
import { sendBookingConfirmation } from "@/lib/email";

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
}

export type CreateBookingResult =
  | { ok: true; manageToken: string }
  | { ok: false; error: string };

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const note = (input.note ?? "").trim();
  const variantIds = Array.isArray(input.variantIds) ? input.variantIds : [];

  if (!input.stylistId || variantIds.length === 0 || !input.startAt) {
    return { ok: false, error: "Unvollständige Buchung." };
  }
  if (!name || !phone || !emailRe.test(email)) {
    return { ok: false, error: "Bitte Name, gültige E-Mail und Telefon angeben." };
  }

  // Recompute everything from the DB — never trust client prices/durations.
  const variants = await prisma.serviceVariant.findMany({
    where: { id: { in: variantIds } },
    include: { service: { select: { id: true, name: true } } },
  });
  if (variants.length !== variantIds.length) {
    return { ok: false, error: "Leistung nicht gefunden." };
  }
  const totalDurationMinutes = variants.reduce((s, v) => s + v.durationMinutes, 0);
  const totalPriceCents = variants.reduce((s, v) => s + v.priceCents, 0);
  const priceIsFrom = variants.some(
    (v) => v.priceType === "FROM" || v.priceType === "ON_REQUEST",
  );

  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Ungültige Zeit." };
  }
  const end = new Date(start.getTime() + totalDurationMinutes * 60_000);

  // Re-validate the slot is actually offered (working hours, lead time, not taken).
  const dateStr = DateTime.fromJSDate(start).setZone(SHOP_TZ).toISODate();
  if (!dateStr) return { ok: false, error: "Ungültige Zeit." };
  const offered = await getAvailableSlots({
    stylistId: input.stylistId,
    date: dateStr,
    durationMinutes: totalDurationMinutes,
  });
  if (!offered.some((d) => d.getTime() === start.getTime())) {
    return { ok: false, error: "Diese Zeit ist nicht mehr verfügbar." };
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
        manageUrl: `${process.env.AUTH_URL ?? "http://localhost:3000"}/booking/${manageToken}`,
      });
    } catch (e) {
      console.error("confirmation email failed:", e);
    }

    return { ok: true, manageToken };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("no_overlap") || msg.includes("23P01") || msg.includes("exclusion")) {
      return {
        ok: false,
        error: "Dieser Termin wurde gerade vergeben. Bitte wähle eine andere Zeit.",
      };
    }
    console.error("createBooking failed:", e);
    return { ok: false, error: "Buchung fehlgeschlagen. Bitte erneut versuchen." };
  }
}
