// Hourly housekeeping, triggered by netlify/functions/cron.mjs → /api/cron.
// Every step is idempotent (timestamps mark what was done), so running it
// twice or late never sends anything twice.
import { prisma } from "@/lib/prisma";
import { emailTransport, sendReminder, sendReviewRequest } from "@/lib/email";
import { pruneLoginAttempts } from "@/lib/login-throttle";
import { siteUrl } from "@/lib/site-url";

const H = 3600_000;
const BATCH = 50;
/** Personal data of past appointments is anonymised after this (see Datenschutz). */
export const RETENTION_DAYS = 365;

export async function runCron(now = new Date()) {
  const sending = emailTransport() !== "log";
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const result = { reminders: 0, reviewRequests: 0, anonymised: 0 };

  if (sending) {
    // Reminder ~24 h ahead — only for bookings made well before (fresh ones just got their confirmation).
    const due = await prisma.appointment.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        reminderSentAt: null,
        customerEmail: { not: "" },
        startAt: { gt: new Date(now.getTime() + 2 * H), lte: new Date(now.getTime() + 24 * H) },
        createdAt: { lt: new Date(now.getTime() - 12 * H) },
      },
      include: { stylist: { select: { name: true } }, items: { select: { nameSnapshot: true } } },
      take: BATCH,
    });
    for (const a of due) {
      try {
        await sendReminder({
          to: a.customerEmail,
          locale: a.locale === "en" ? "en" : "de",
          customerName: a.customerName,
          barberName: a.stylist.name,
          startAt: a.startAt,
          services: a.items.map((i) => i.nameSnapshot),
          manageUrl: `${siteUrl()}/booking/${a.manageToken}`,
          shopPhone: setting?.shopPhone ?? "",
        });
        await prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: new Date() } });
        result.reminders++;
      } catch (e) {
        console.error("reminder failed:", a.id, e);
      }
    }

    // Review request ~2 h after the end, for appointments nobody marked as no-show/cancelled.
    const done = await prisma.appointment.findMany({
      where: {
        status: { in: ["CONFIRMED", "COMPLETED"] },
        reviewRequestedAt: null,
        customerEmail: { not: "" },
        endAt: { lte: new Date(now.getTime() - 2 * H), gt: new Date(now.getTime() - 72 * H) },
      },
      include: { stylist: { select: { name: true } } },
      take: BATCH,
    });
    for (const a of done) {
      try {
        await sendReviewRequest({
          to: a.customerEmail,
          locale: a.locale === "en" ? "en" : "de",
          customerName: a.customerName,
          barberName: a.stylist.name,
          reviewUrl: `${siteUrl()}/review/${a.reviewToken}`,
        });
        await prisma.appointment.update({ where: { id: a.id }, data: { reviewRequestedAt: new Date(), status: "COMPLETED" } });
        result.reviewRequests++;
      } catch (e) {
        console.error("review request failed:", a.id, e);
      }
    }
  }

  // Data minimisation: strip personal data from old appointments.
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * H);
  const anon = await prisma.appointment.updateMany({
    where: { endAt: { lt: cutoff }, customerName: { not: "–" } },
    data: { customerName: "–", customerEmail: "", customerPhone: "", customerNote: null, customerId: null },
  });
  result.anonymised = anon.count;
  await prisma.customer.deleteMany({ where: { appointments: { none: {} } } });
  await pruneLoginAttempts();

  return result;
}
