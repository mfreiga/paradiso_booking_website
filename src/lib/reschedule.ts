// Moving an existing booking to another time (and, for the salon, another
// barber). Shared by the customer's manage page and the admin.
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getAvailabilityRange, getAvailableSlots } from "@/lib/availability";
import { appointmentIcs } from "@/lib/appointment-ics";
import { sendMoved } from "@/lib/email";
import { notifyShop } from "@/lib/push";
import { siteUrl } from "@/lib/site-url";

const TZ = process.env.SHOP_TIMEZONE ?? "Europe/Berlin";

export type MoveError = "notFound" | "inactive" | "tooLate" | "combo" | "unavailable" | "taken";

async function load(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { items: { select: { serviceId: true, nameSnapshot: true } }, stylist: { select: { name: true } } },
  });
}

/** Barbers (active) who offer every service of the booking — candidates for a move. */
export async function qualifiedBarbersFor(appointmentId: string) {
  const appt = await load(appointmentId);
  if (!appt) return [];
  const serviceIds = appt.items.map((i) => i.serviceId);
  const barbers = await prisma.stylist.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true, workingHours: { select: { weekday: true } }, services: { select: { serviceId: true } } },
  });
  return barbers
    .filter((b) => serviceIds.every((s) => b.services.some((x) => x.serviceId === s)))
    .map((b) => ({ id: b.id, name: b.name, weekdays: [...new Set(b.workingHours.map((w) => w.weekday))] }));
}

/** Days of `month` ("YYYY-MM") with a free slot long enough for this booking (its own slot counts as free). */
export async function moveOpenDays(appointmentId: string, stylistId: string, month: string, ignoreLeadTime: boolean) {
  const appt = await load(appointmentId);
  if (!appt || !/^\d{4}-\d{2}$/.test(month)) return [];
  const start = DateTime.fromISO(`${month}-01`, { zone: TZ });
  const range = await getAvailabilityRange({
    stylistId,
    from: start.toISODate()!,
    to: start.endOf("month").toISODate()!,
    durationMinutes: appt.totalDurationMinutes,
    ignoreLeadTime,
    excludeAppointmentId: appt.id,
  });
  return [...range].filter(([, s]) => s.length > 0).map(([d]) => d);
}

export async function moveSlots(appointmentId: string, stylistId: string, date: string, ignoreLeadTime: boolean) {
  const appt = await load(appointmentId);
  if (!appt) return [];
  const slots = await getAvailableSlots({
    stylistId,
    date,
    durationMinutes: appt.totalDurationMinutes,
    ignoreLeadTime,
    excludeAppointmentId: appt.id,
  });
  return slots.map((d) => d.toISOString());
}

export async function moveAppointment(opts: {
  appointmentId: string;
  stylistId: string;
  startAt: string;
  by: "customer" | "shop";
}): Promise<{ ok: true } | { ok: false; error: MoveError }> {
  const appt = await load(opts.appointmentId);
  if (!appt) return { ok: false, error: "notFound" };
  if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") return { ok: false, error: "inactive" };

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  if (opts.by === "customer") {
    if (opts.stylistId !== appt.stylistId) return { ok: false, error: "combo" };
    const cutoff = (setting?.cancellationCutoffMin ?? 120) * 60_000;
    if (appt.startAt.getTime() - Date.now() <= cutoff) return { ok: false, error: "tooLate" };
  }

  const barbers = await qualifiedBarbersFor(appt.id);
  if (!barbers.some((b) => b.id === opts.stylistId)) return { ok: false, error: "combo" };

  const start = new Date(opts.startAt);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "unavailable" };
  const date = DateTime.fromJSDate(start).setZone(TZ).toISODate()!;
  const offered = await moveSlots(appt.id, opts.stylistId, date, opts.by === "shop");
  if (!offered.includes(start.toISOString())) return { ok: false, error: "unavailable" };

  const end = new Date(start.getTime() + appt.totalDurationMinutes * 60_000);
  try {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { startAt: start, endAt: end, stylistId: opts.stylistId, reminderSentAt: null },
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("no_overlap") || msg.includes("23P01") || msg.includes("exclusion")) return { ok: false, error: "taken" };
    throw e;
  }

  const barberName = barbers.find((b) => b.id === opts.stylistId)?.name ?? appt.stylist.name;
  const locale = appt.locale === "en" ? "en" : "de";
  const manageUrl = `${siteUrl()}/booking/${appt.manageToken}`;
  const services = appt.items.map((i) => i.nameSnapshot);
  try {
    await sendMoved({
      to: appt.customerEmail,
      locale,
      customerName: appt.customerName,
      barberName,
      oldStartAt: appt.startAt,
      startAt: start,
      services,
      manageUrl,
      calendarUrl: `${manageUrl}/calendar.ics`,
      ics: appointmentIcs({ id: appt.id, startAt: start, endAt: end, stylistName: barberName, services, manageUrl, locale, address: setting?.shopAddress }),
      by: opts.by,
    });
  } catch (e) {
    console.error("moved email failed:", e);
  }
  if (opts.by === "customer") {
    const fmt = (d: Date) => DateTime.fromJSDate(d).setZone(TZ).setLocale("de").toFormat("ccc dd.MM., HH:mm");
    await notifyShop({ title: `Verschoben: ${appt.customerName}`, body: `${fmt(appt.startAt)} → ${fmt(start)} · ${barberName}`, url: `/admin/calendar?view=day&date=${date}` });
  }
  return { ok: true };
}
