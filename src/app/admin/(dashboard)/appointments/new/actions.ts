"use server";

import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { allowedStylist, isOwner, requireStaff } from "@/lib/auth-guard";
import { getAvailableSlots } from "@/lib/availability";
import { emailTransport, sendBookingConfirmation } from "@/lib/email";
import { appointmentIcs } from "@/lib/appointment-ics";
import { siteUrl } from "@/lib/site-url";
import { notifyStaff } from "@/lib/push";
import { ANY_BARBER } from "@/lib/admin-booking";

const SHOP_TZ = process.env.SHOP_TIMEZONE ?? "Europe/Berlin";

export type AdminSlot = { iso: string; stylistId: string };

/**
 * Free times for the phone/walk-in form — same engine as online booking but
 * without the lead-time buffer. "any" merges all barbers who offer every
 * selected service (owner only; a barber always books into their own column).
 */
export async function getAdminSlots(stylistId: string, date: string, variantIds: string[]): Promise<AdminSlot[]> {
  const staff = await requireStaff();
  if (!date || variantIds.length === 0) return [];
  const variants = await prisma.serviceVariant.findMany({
    where: { id: { in: variantIds } },
    select: { durationMinutes: true, serviceId: true },
  });
  const durationMinutes = variants.reduce((s, v) => s + v.durationMinutes, 0);
  if (durationMinutes <= 0) return [];

  let ids: string[];
  if (stylistId === ANY_BARBER && isOwner(staff)) {
    const serviceIds = [...new Set(variants.map((v) => v.serviceId))];
    const rows = await prisma.stylist.findMany({
      where: { isActive: true, AND: serviceIds.map((serviceId) => ({ services: { some: { serviceId } } })) },
      orderBy: { displayOrder: "asc" },
      select: { id: true },
    });
    ids = rows.map((r) => r.id);
  } else {
    const allowed = allowedStylist(staff, stylistId === ANY_BARBER ? "" : stylistId);
    ids = allowed ? [allowed] : [];
  }

  const perBarber = await Promise.all(
    ids.map((id) => getAvailableSlots({ stylistId: id, date, durationMinutes, ignoreLeadTime: true })),
  );
  const byTime = new Map<string, string>();
  perBarber.forEach((slots, i) => {
    for (const d of slots) if (!byTime.has(d.toISOString())) byTime.set(d.toISOString(), ids[i]);
  });
  return [...byTime.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([iso, id]) => ({ iso, stylistId: id }));
}

export type KnownCustomer = {
  name: string;
  phone: string;
  email: string;
  visits: number;
  noShows: number;
  lastBarber: string | null;
};

/**
 * Returning customers matching a phone number or name, from past bookings —
 * so a phone booking for a regular takes seconds. Barbers only see people
 * who booked with them.
 */
export async function findCustomers(query: string): Promise<KnownCustomer[]> {
  const staff = await requireStaff();
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return [];
  // Phones are stored as typed ("0170 123 45", "+49170…"): compare digits only,
  // with a leading 49 treated as 0, on both sides.
  const digits = q.replace(/\D/g, "").replace(/^49(?=\d{6})/, "0");
  const phoneIds =
    digits.length >= 3
      ? (
          await prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Appointment"
            WHERE regexp_replace(regexp_replace("customerPhone", '\\D', '', 'g'), '^49', '0') LIKE ${`%${digits}%`}
            ORDER BY "startAt" DESC LIMIT 60`
        ).map((r) => r.id)
      : [];

  const rows = await prisma.appointment.findMany({
    where: {
      ...(isOwner(staff) ? {} : { stylistId: staff.stylistId ?? "__none__" }),
      customerName: { not: "–" }, // anonymised after 12 months
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        ...(phoneIds.length ? [{ id: { in: phoneIds } }] : []),
        ...(q.includes("@") ? [{ customerEmail: { contains: q.toLowerCase() } }] : []),
      ],
    },
    orderBy: { startAt: "desc" },
    take: 60,
    select: { customerName: true, customerPhone: true, customerEmail: true, status: true, stylist: { select: { name: true } } },
  });

  // One entry per person (phone, else email, else name).
  const people = new Map<string, KnownCustomer>();
  for (const r of rows) {
    const key = r.customerPhone.replace(/\D/g, "") || r.customerEmail || r.customerName.toLowerCase();
    const p = people.get(key) ?? {
      name: r.customerName,
      phone: r.customerPhone,
      email: r.customerEmail,
      visits: 0,
      noShows: 0,
      lastBarber: r.stylist.name,
    };
    if (r.status === "COMPLETED") p.visits++;
    if (r.status === "NO_SHOW") p.noShows++;
    if (!p.email && r.customerEmail) p.email = r.customerEmail;
    people.set(key, p);
  }
  return [...people.values()].slice(0, 6);
}

export type AdminBookingResult =
  | { ok: true; id: string; stylistName: string; startAt: string; emailed: boolean }
  | { ok: false; error: string };

export async function createAdminBooking(input: {
  stylistId: string;
  variantIds: string[];
  startAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  note?: string;
}): Promise<AdminBookingResult> {
  const staff = await requireStaff();
  const name = (input.customerName ?? "").trim().slice(0, 100);
  const phone = (input.customerPhone ?? "").trim().slice(0, 40);
  const email = (input.customerEmail ?? "").trim().toLowerCase().slice(0, 200);
  const note = (input.note ?? "").trim().slice(0, 500);
  const variantIds = input.variantIds ?? [];
  // Barbers can only book into their own calendar.
  const stylistId = allowedStylist(staff, input.stylistId);

  if (!stylistId) return { ok: false, error: "Du kannst nur Termine in deinem eigenen Kalender eintragen." };
  if (variantIds.length === 0 || !input.startAt || !name) {
    return { ok: false, error: "Bitte Leistung, Zeit und Name angeben." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Die E-Mail-Adresse sieht nicht richtig aus." };
  }

  const [variants, stylist] = await Promise.all([
    prisma.serviceVariant.findMany({
      where: { id: { in: variantIds } },
      include: { service: { select: { id: true, name: true } } },
    }),
    prisma.stylist.findUnique({
      where: { id: stylistId },
      select: { name: true, isActive: true, services: { select: { serviceId: true } } },
    }),
  ]);
  if (variants.length !== variantIds.length) return { ok: false, error: "Leistung nicht gefunden." };
  const offers = new Set(stylist?.services.map((s) => s.serviceId));
  if (!stylist?.isActive || variants.some((v) => !offers.has(v.service.id))) {
    return { ok: false, error: `${stylist?.name ?? "Diese:r Friseur:in"} bietet nicht alle gewählten Leistungen an.` };
  }
  const totalDurationMinutes = variants.reduce((s, v) => s + v.durationMinutes, 0);
  const totalPriceCents = variants.reduce((s, v) => s + v.priceCents, 0);
  const priceIsFrom = variants.some((v) => v.priceType === "FROM" || v.priceType === "ON_REQUEST");

  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Ungültige Zeit." };
  const end = new Date(start.getTime() + totalDurationMinutes * 60_000);

  const dateStr = DateTime.fromJSDate(start).setZone(SHOP_TZ).toISODate();
  if (!dateStr) return { ok: false, error: "Ungültige Zeit." };
  const offered = await getAvailableSlots({ stylistId, date: dateStr, durationMinutes: totalDurationMinutes, ignoreLeadTime: true });
  if (!offered.some((d) => d.getTime() === start.getTime())) {
    return { ok: false, error: "Diese Zeit ist inzwischen nicht mehr frei. Bitte neu wählen." };
  }

  const manageToken = randomBytes(24).toString("hex");
  let appt;
  try {
    appt = await prisma.appointment.create({
      data: {
        stylistId,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerNote: note || null,
        startAt: start,
        endAt: end,
        status: "CONFIRMED",
        totalPriceCents,
        totalDurationMinutes,
        priceIsFrom,
        manageToken,
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
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("no_overlap") || msg.includes("23P01") || msg.includes("exclusion")) {
      return { ok: false, error: "Überschneidung mit einem bestehenden Termin." };
    }
    console.error("createAdminBooking failed:", e);
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  let emailed = false;
  if (email) {
    try {
      const setting = await prisma.setting.findUnique({ where: { id: 1 } });
      const manageUrl = `${siteUrl()}/booking/${manageToken}`;
      const services = variants.map((v) => v.service.name);
      await sendBookingConfirmation({
        to: email,
        locale: "de",
        customerName: name,
        customerPhone: phone,
        barberName: stylist.name,
        startAt: start,
        durationMinutes: totalDurationMinutes,
        services,
        totalPriceCents,
        priceIsFrom,
        manageUrl,
        calendarUrl: `${manageUrl}/calendar.ics`,
        ics: appointmentIcs({ id: appt.id, startAt: start, endAt: end, stylistName: stylist.name, services, manageUrl, locale: "de", address: setting?.shopAddress }),
        shopPhone: setting?.shopPhone ?? "089 57933371",
        cancelCutoffHours: Math.round((setting?.cancellationCutoffMin ?? 120) / 60),
        adminUrl: `${siteUrl()}/admin/appointments`,
        notifyShop: false,
      });
      // Only a real send counts (without email setup it's just logged).
      emailed = emailTransport() !== "log";
      if (emailed) await prisma.appointment.update({ where: { id: appt.id }, data: { confirmationSentAt: new Date() } });
    } catch (e) {
      console.error("admin booking confirmation failed:", e);
    }
  }

  // The barber (and owner) get a push — but not the person who just typed it in.
  const when = DateTime.fromJSDate(start).setZone(SHOP_TZ).setLocale("de").toFormat("ccc dd.MM., HH:mm");
  await notifyStaff(
    {
      title: `Neuer Termin (eingetragen): ${when}`,
      body: `${name} · ${stylist.name} · ${variants.map((v) => v.service.name).join(", ")}`,
      url: `/admin/calendar?view=day&date=${dateStr}`,
    },
    { stylistIds: [stylistId], excludeUserId: staff.isEnvAdmin ? undefined : staff.id },
  );

  for (const p of ["/admin/appointments", "/admin", "/admin/calendar"]) revalidatePath(p);
  return { ok: true, id: appt.id, stylistName: stylist.name, startAt: start.toISOString(), emailed };
}
