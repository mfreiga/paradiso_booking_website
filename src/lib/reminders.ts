import { prisma } from "./prisma";
import { emailTransport } from "./email";
import { sendAppointmentEmail } from "./appointment-email";

const HOUR = 3600_000;
/** Remind appointments starting within this window from now… */
const REMIND_WITHIN_MS = 24 * HOUR;
/** …but not ones starting very soon (the customer just booked / is on the way). */
const MIN_AHEAD_MS = 2 * HOUR;
/** Skip short-notice bookings: they got their confirmation moments ago. */
const MIN_BOOKED_AHEAD_MS = 12 * HOUR;

/**
 * Sends the day-before reminder for every due appointment. Safe to run as
 * often as you like (hourly via Netlify): each appointment is claimed
 * atomically (reminderSentAt) before its email goes out, so it's sent once.
 */
export async function sendDueReminders(now = new Date()): Promise<{ checked: number; sent: number; failed: number }> {
  const due = await prisma.appointment.findMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      reminderSentAt: null,
      customerEmail: { not: "" },
      startAt: { gt: new Date(now.getTime() + MIN_AHEAD_MS), lte: new Date(now.getTime() + REMIND_WITHIN_MS) },
    },
    select: { id: true, startAt: true, createdAt: true },
  });

  let sent = 0;
  let failed = 0;
  for (const a of due) {
    if (a.startAt.getTime() - a.createdAt.getTime() < MIN_BOOKED_AHEAD_MS) continue;
    const claimed = await prisma.appointment.updateMany({
      where: { id: a.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue; // another run got it first
    try {
      if (await sendAppointmentEmail(a.id, "reminder")) sent++;
    } catch (e) {
      failed++;
      console.error("reminder failed for", a.id, e);
      // Release the claim so the next run retries.
      await prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: null } });
    }
  }
  return { checked: due.length, sent, failed };
}

/** Human-readable setup status for the admin settings page. */
export function reminderStatus(): { ok: boolean; text: string } {
  if (emailTransport() === "log") return { ok: false, text: "aus – zuerst E-Mail-Versand einrichten" };
  if (!process.env.CRON_SECRET) return { ok: false, text: "aus – CRON_SECRET auf Netlify setzen" };
  return { ok: true, text: "aktiv – stündliche Prüfung, Erinnerung ca. 24 Std. vorher ✓" };
}
