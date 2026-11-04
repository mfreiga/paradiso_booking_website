"use server";

import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { getAvailableSlots } from "@/lib/availability";
import { sendCancellation, sendReviewRequest } from "@/lib/email";
import { sendAppointmentEmail } from "@/lib/appointment-email";
import { siteUrl } from "@/lib/site-url";

const SHOP_TZ = process.env.SHOP_TIMEZONE ?? "Europe/Berlin";
const allowed = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
type ApptStatus = (typeof allowed)[number];
const isActive = (s: string) => s === "PENDING" || s === "CONFIRMED";

function revalidateAppointment(id: string) {
  revalidatePath("/admin/appointments");
  revalidatePath(`/admin/appointments/${id}`);
  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
}

/**
 * Status changes from the admin. Guards against mistakes that email the
 * customer: "done"/"no-show" only once the appointment has started, cancel
 * only while it's still active, and "undo" only back from done/no-show.
 */
export async function setAppointmentStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as ApptStatus;
  // Cancellation email only when the "notify customer" box was ticked
  // (an unticked checkbox sends nothing, so absence must mean "no").
  const notify = formData.get("notify") === "1";
  if (!allowed.includes(status)) return;
  const before = await prisma.appointment.findUnique({
    where: { id },
    include: { stylist: { select: { name: true } }, items: { select: { nameSnapshot: true } } },
  });
  if (!before || before.status === status) return;

  const started = before.startAt.getTime() <= Date.now();
  const ok =
    ((status === "COMPLETED" || status === "NO_SHOW") && isActive(before.status) && started) ||
    (status === "CANCELLED" && isActive(before.status)) ||
    (status === "CONFIRMED" && (before.status === "COMPLETED" || before.status === "NO_SHOW"));
  if (!ok) return;

  await prisma.appointment.update({ where: { id }, data: { status } });
  const locale = before.locale === "en" ? "en" : "de";

  try {
    // Done → ask for a review (only once). Cancelled by the salon → tell the customer.
    if (status === "COMPLETED" && before.customerEmail) {
      const reviewed = await prisma.review.count({ where: { appointmentId: id } });
      if (!reviewed) {
        await sendReviewRequest({
          to: before.customerEmail,
          locale,
          customerName: before.customerName,
          barberName: before.stylist.name,
          reviewUrl: `${siteUrl()}/review/${before.reviewToken}`,
        });
      }
    }
    if (status === "CANCELLED" && notify && before.customerEmail && !started) {
      await sendCancellation({
        to: before.customerEmail,
        locale,
        customerName: before.customerName,
        barberName: before.stylist.name,
        startAt: before.startAt,
        services: before.items.map((i) => i.nameSnapshot),
        bookUrl: `${siteUrl()}/book`,
        by: "shop",
      });
    }
  } catch (e) {
    console.error("status email failed:", e);
  }

  revalidateAppointment(id);
}

/** Internal note (only visible in the admin area). */
export async function saveAdminNote(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const note = String(formData.get("adminNote") ?? "").trim().slice(0, 1000);
  await prisma.appointment.update({ where: { id }, data: { adminNote: note || null } });
  revalidateAppointment(id);
}

/** Free start times for moving an appointment (its own current slot counts as free). */
export async function getRescheduleSlots(
  appointmentId: string,
  stylistId: string,
  date: string,
): Promise<string[]> {
  await requireAdmin();
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { totalDurationMinutes: true },
  });
  if (!appt || !stylistId || !date) return [];
  const slots = await getAvailableSlots({
    stylistId,
    date,
    durationMinutes: appt.totalDurationMinutes,
    ignoreLeadTime: true,
    excludeAppointmentId: appointmentId,
  });
  return slots.map((d) => d.toISOString());
}

export type RescheduleResult = { ok: true; emailed: boolean } | { ok: false; error: string };

export async function rescheduleAppointment(input: {
  id: string;
  stylistId: string;
  startAt: string;
  notify: boolean;
}): Promise<RescheduleResult> {
  await requireAdmin();
  const appt = await prisma.appointment.findUnique({
    where: { id: input.id },
    include: { items: { select: { serviceId: true } } },
  });
  if (!appt) return { ok: false, error: "Termin nicht gefunden." };
  if (!isActive(appt.status)) {
    return { ok: false, error: "Nur offene oder bestätigte Termine können verschoben werden." };
  }

  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Ungültige Zeit." };
  if (start.getTime() === appt.startAt.getTime() && input.stylistId === appt.stylistId) {
    return { ok: false, error: "Das ist schon die aktuelle Zeit." };
  }

  // A different barber must be active and offer every booked service.
  if (input.stylistId !== appt.stylistId) {
    const stylist = await prisma.stylist.findUnique({
      where: { id: input.stylistId },
      select: { isActive: true, services: { select: { serviceId: true } } },
    });
    const offers = new Set(stylist?.services.map((s) => s.serviceId));
    if (!stylist?.isActive || appt.items.some((i) => i.serviceId && !offers.has(i.serviceId))) {
      return { ok: false, error: "Diese:r Friseur:in bietet nicht alle gebuchten Leistungen an." };
    }
  }

  const dateStr = DateTime.fromJSDate(start).setZone(SHOP_TZ).toISODate();
  const offered = dateStr
    ? await getAvailableSlots({
        stylistId: input.stylistId,
        date: dateStr,
        durationMinutes: appt.totalDurationMinutes,
        ignoreLeadTime: true,
        excludeAppointmentId: appt.id,
      })
    : [];
  if (!offered.some((d) => d.getTime() === start.getTime())) {
    return { ok: false, error: "Diese Zeit ist nicht mehr frei." };
  }

  try {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        stylistId: input.stylistId,
        startAt: start,
        endAt: new Date(start.getTime() + appt.totalDurationMinutes * 60_000),
        reminderSentAt: null, // the new time gets its own reminder
      },
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("no_overlap") || msg.includes("23P01") || msg.includes("exclusion")) {
      return { ok: false, error: "Überschneidung mit einem anderen Termin." };
    }
    console.error("reschedule failed:", e);
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  let emailed = false;
  if (input.notify) {
    try {
      emailed = await sendAppointmentEmail(appt.id, "moved");
    } catch (e) {
      console.error("reschedule email failed:", e);
    }
  }
  revalidateAppointment(appt.id);
  return { ok: true, emailed };
}
