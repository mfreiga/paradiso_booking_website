import { prisma } from "./prisma";
import { sendBookingConfirmation, type BookingEmailData } from "./email";
import { appointmentIcs } from "./appointment-ics";
import { siteUrl } from "./site-url";

/**
 * Sends the customer email for an existing appointment ("moved" after a
 * reschedule, or the day-before "reminder"). Loads everything from the DB so
 * callers only pass the id. Returns false when there is no email to send to.
 */
export async function sendAppointmentEmail(
  appointmentId: string,
  kind: NonNullable<BookingEmailData["kind"]>,
): Promise<boolean> {
  const [a, setting] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        stylist: { select: { name: true } },
        items: { select: { nameSnapshot: true } },
      },
    }),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);
  if (!a?.customerEmail) return false;

  const locale = a.locale === "en" ? "en" : "de";
  const manageUrl = `${siteUrl()}/booking/${a.manageToken}`;
  const services = a.items.map((i) => i.nameSnapshot);
  await sendBookingConfirmation({
    kind,
    to: a.customerEmail,
    locale,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    barberName: a.stylist.name,
    startAt: a.startAt,
    durationMinutes: a.totalDurationMinutes,
    services,
    totalPriceCents: a.totalPriceCents,
    priceIsFrom: a.priceIsFrom,
    manageUrl,
    calendarUrl: `${manageUrl}/calendar.ics`,
    ics: appointmentIcs({
      id: a.id,
      startAt: a.startAt,
      endAt: a.endAt,
      stylistName: a.stylist.name,
      services,
      manageUrl,
      locale,
      address: setting?.shopAddress,
    }),
    shopPhone: setting?.shopPhone ?? "089 57933371",
    cancelCutoffHours: Math.round((setting?.cancellationCutoffMin ?? 120) / 60),
    adminUrl: `${siteUrl()}/admin/appointments/${a.id}`,
    notifyShop: false,
  });
  return true;
}
