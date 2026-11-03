import Link from "next/link";
import type { Metadata } from "next";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { dict, dateLocale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { msUntil } from "@/lib/time";
import { CustomerShell } from "@/components/customer-shell";
import { RescheduleForm } from "@/components/reschedule-form";
import { getMoveDays, getMoveSlots, moveBooking } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Termin verschieben", robots: { index: false } };

export default async function MoveBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const t = dict[locale].manage;
  const b = dict[locale].book;
  const loc = dateLocale[locale];

  const appt = await prisma.appointment.findUnique({
    where: { manageToken: token },
    include: { stylist: { select: { id: true, name: true } } },
  });
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const active = appt && (appt.status === "PENDING" || appt.status === "CONFIRMED");
  const tooLate = appt ? msUntil(appt.startAt) <= (setting?.cancellationCutoffMin ?? 120) * 60_000 : false;

  if (!appt || !active || tooLate) {
    return (
      <CustomerShell locale={locale}>
        <p className="text-center text-neutral-400">
          {!appt ? t.notFound : !active ? t.cancelled : `${t.tooLateMove}${setting?.shopPhone ? `: ${setting.shopPhone}` : ""}.`}
        </p>
        {appt && (
          <p className="mt-4 text-center">
            <Link href={`/booking/${token}`} className="text-sm text-neutral-400 underline">
              {t.back}
            </Link>
          </p>
        )}
      </CustomerShell>
    );
  }

  const now = DateTime.now().setZone("Europe/Berlin");
  const current = new Intl.DateTimeFormat(loc, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(appt.startAt);

  return (
    <CustomerShell locale={locale}>
      <Link href={`/booking/${token}`} className="text-sm text-neutral-400 hover:text-white">
        ← {t.back}
      </Link>
      <h2 className="mt-2 text-xl font-semibold">{t.moveTitle}</h2>
      <p className="mb-4 mt-1 text-sm text-neutral-400">
        {t.moveCurrent}: {current} · {appt.stylist.name}
      </p>
      <RescheduleForm
        barbers={[appt.stylist]}
        initialBarberId={appt.stylist.id}
        loadDays={getMoveDays.bind(null, token)}
        loadSlots={getMoveSlots.bind(null, token)}
        submit={moveBooking.bind(null, token)}
        minDate={now.toISODate()!}
        maxDate={now.plus({ days: setting?.bookingWindowDays ?? 60 }).toISODate()!}
        weekdaysShort={dict[locale].weekdaysShort}
        locale={loc}
        labels={{
          date: b.whenTitle,
          noSlots: b.noSlots,
          loading: b.loadingSlots,
          confirm: t.moveConfirm,
          moving: t.moving,
          failed: t.moveFailed,
          prevMonth: b.prevMonth,
          nextMonth: b.nextMonth,
          morning: b.morning,
          afternoon: b.afternoon,
          evening: b.evening,
        }}
        doneHref={`/booking/${token}?moved=1`}
      />
    </CustomerShell>
  );
}
