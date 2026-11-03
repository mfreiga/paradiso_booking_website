import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatEur } from "@/lib/format";
import { dict, dateLocale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { tName } from "@/lib/service-i18n";
import { msUntil } from "@/lib/time";
import { CustomerShell } from "@/components/customer-shell";
import { cancelBooking } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dein Termin", robots: { index: false } };

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ moved?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const t = dict[locale].manage;
  const lengths = dict[locale].book.lengths;
  const longDateTime = new Intl.DateTimeFormat(dateLocale[locale], {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
  const appt = await prisma.appointment.findUnique({
    where: { manageToken: token },
    include: { stylist: { select: { name: true } }, items: { include: { service: { select: { nameEn: true } } } } },
  });

  if (!appt) {
    return (
      <CustomerShell locale={locale}>
        <p className="text-center text-neutral-400">{t.notFound}</p>
      </CustomerShell>
    );
  }

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const cutoffMin = setting?.cancellationCutoffMin ?? 120;
  const phone = setting?.shopPhone ?? "";
  const active = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const tooLate = msUntil(appt.startAt) <= cutoffMin * 60_000;
  const pill = "inline-block rounded-full border px-5 py-2.5 text-sm font-medium transition";

  return (
    <CustomerShell locale={locale}>
      <h2 className="text-xl font-semibold">{t.title}</h2>
      {sp.moved && <p className="mt-3 rounded-lg bg-green-500/10 p-3 text-sm text-green-400">{t.moved}</p>}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="font-medium">
          {appt.items
            .map(
              (i) =>
                tName(i.nameSnapshot, locale, i.service?.nameEn) +
                (i.variantLabelSnapshot && i.variantLabelSnapshot !== "Standard"
                  ? ` (${lengths[i.variantLabelSnapshot] ?? i.variantLabelSnapshot})`
                  : ""),
            )
            .join(", ")}
        </div>
        <div className="text-neutral-400">
          {appt.stylist.name} · {longDateTime.format(appt.startAt)}
          {locale === "de" ? " Uhr" : ""}
        </div>
        <div className="mt-1">
          {appt.priceIsFrom ? `${t.from} ` : ""}
          {formatEur(appt.totalPriceCents, dateLocale[locale])} · {t.payNote}
        </div>
      </div>

      {appt.status === "CANCELLED" ? (
        <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{t.cancelled}</p>
      ) : appt.status === "COMPLETED" ? (
        <p className="mt-4 rounded-lg bg-white/5 p-3 text-sm text-neutral-400">{t.completed}</p>
      ) : !active ? (
        <p className="mt-4 text-sm text-neutral-400">
          {t.status}: {appt.status}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <a href={`/booking/${token}/calendar.ics`} className={`${pill} border-orange-500 bg-orange-500 text-white hover:bg-orange-600`}>
              {t.addToCalendar}
            </a>
            {!tooLate && (
              <Link href={`/booking/${token}/move`} className={`${pill} border-white/20 hover:bg-white/10`}>
                {t.move}
              </Link>
            )}
          </div>
          {tooLate ? (
            <p className="text-sm text-neutral-400">
              {t.tooLate}
              {phone ? `: ${phone}` : ""}.
            </p>
          ) : (
            // Two steps without JavaScript: the first tap only opens the confirmation.
            <details className="group">
              <summary className={`${pill} cursor-pointer list-none border-red-500/40 text-red-400 hover:bg-red-500/10 group-open:hidden [&::-webkit-details-marker]:hidden`}>
                {t.cancel}
              </summary>
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm">{t.cancelConfirm}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={cancelBooking}>
                    <input type="hidden" name="token" value={token} />
                    <button className={`${pill} border-red-500 bg-red-600 text-white hover:bg-red-700`}>{t.cancelYes}</button>
                  </form>
                  <a href={`/booking/${token}`} className={`${pill} border-white/20 hover:bg-white/10`}>
                    {t.keep}
                  </a>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </CustomerShell>
  );
}
