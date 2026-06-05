"use server";

import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { getAvailableSlots } from "@/lib/availability";

const SHOP_TZ = process.env.SHOP_TIMEZONE ?? "Europe/Berlin";

/** Slots for the admin form — same engine, but ignoring the lead-time buffer. */
export async function getAdminSlots(
  stylistId: string,
  date: string,
  variantIds: string[],
): Promise<string[]> {
  await requireAdmin();
  if (!stylistId || !date || variantIds.length === 0) return [];
  const variants = await prisma.serviceVariant.findMany({
    where: { id: { in: variantIds } },
    select: { durationMinutes: true },
  });
  const durationMinutes = variants.reduce((s, v) => s + v.durationMinutes, 0);
  if (durationMinutes <= 0) return [];
  const slots = await getAvailableSlots({
    stylistId,
    date,
    durationMinutes,
    ignoreLeadTime: true,
  });
  return slots.map((d) => d.toISOString());
}

export type AdminBookingResult = { ok: true } | { ok: false; error: string };

export async function createAdminBooking(input: {
  stylistId: string;
  variantIds: string[];
  startAt: string;
  customerName: string;
  customerPhone: string;
}): Promise<AdminBookingResult> {
  await requireAdmin();
  const name = (input.customerName ?? "").trim();
  const phone = (input.customerPhone ?? "").trim();
  const variantIds = input.variantIds ?? [];

  if (!input.stylistId || variantIds.length === 0 || !input.startAt || !name) {
    return { ok: false, error: "Bitte Friseur:in, Leistung, Zeit und Name angeben." };
  }

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
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Ungültige Zeit." };
  const end = new Date(start.getTime() + totalDurationMinutes * 60_000);

  const dateStr = DateTime.fromJSDate(start).setZone(SHOP_TZ).toISODate();
  if (!dateStr) return { ok: false, error: "Ungültige Zeit." };
  const offered = await getAvailableSlots({
    stylistId: input.stylistId,
    date: dateStr,
    durationMinutes: totalDurationMinutes,
    ignoreLeadTime: true,
  });
  if (!offered.some((d) => d.getTime() === start.getTime())) {
    return { ok: false, error: "Diese Zeit ist nicht verfügbar." };
  }

  try {
    await prisma.appointment.create({
      data: {
        stylistId: input.stylistId,
        customerName: name,
        customerEmail: "",
        customerPhone: phone,
        startAt: start,
        endAt: end,
        status: "CONFIRMED",
        totalPriceCents,
        totalDurationMinutes,
        priceIsFrom,
        manageToken: randomBytes(24).toString("hex"),
        reviewToken: randomBytes(24).toString("hex"),
        source: "ADMIN",
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
    revalidatePath("/admin/appointments");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("no_overlap") || msg.includes("23P01") || msg.includes("exclusion")) {
      return { ok: false, error: "Überschneidung mit einem bestehenden Termin." };
    }
    console.error("createAdminBooking failed:", e);
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
}
