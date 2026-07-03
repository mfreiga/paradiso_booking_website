import { prisma } from "@/lib/prisma";
import { formatEur } from "@/lib/format";
import { dict, dateLocale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { tName } from "@/lib/service-i18n";
import { cancelBooking } from "./actions";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-stone-50 text-neutral-900">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-orange-500">
            Hairstyling
          </p>
          <p className="text-2xl font-bold tracking-tight">Paradiso</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const t = dict[locale].manage;
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
    include: { stylist: { select: { name: true } }, items: true },
  });

  if (!appt) {
    return (
      <Shell>
        <p className="text-center text-neutral-600">{t.notFound}</p>
      </Shell>
    );
  }

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const cutoffMin = setting?.cancellationCutoffMin ?? 120;
  const phone = setting?.shopPhone ?? "";
  const active = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const tooLate = appt.startAt.getTime() - Date.now() <= cutoffMin * 60_000;

  return (
    <Shell>
      <h2 className="text-xl font-semibold">{t.title}</h2>
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <div className="font-medium">
          {appt.items
            .map(
              (i) =>
                tName(i.nameSnapshot, locale) +
                (i.variantLabelSnapshot && i.variantLabelSnapshot !== "Standard"
                  ? ` (${i.variantLabelSnapshot})`
                  : ""),
            )
            .join(", ")}
        </div>
        <div className="text-neutral-500">
          {appt.stylist.name} · {longDateTime.format(appt.startAt)}
          {locale === "de" ? " Uhr" : ""}
        </div>
        <div className="mt-1">
          {appt.priceIsFrom ? `${t.from} ` : ""}
          {formatEur(appt.totalPriceCents)} · {t.payNote}
        </div>
      </div>

      {appt.status === "CANCELLED" ? (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {t.cancelled}
        </p>
      ) : appt.status === "COMPLETED" ? (
        <p className="mt-4 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-600">
          {t.completed}
        </p>
      ) : !active ? (
        <p className="mt-4 text-sm text-neutral-500">
          {t.status}: {appt.status}
        </p>
      ) : tooLate ? (
        <p className="mt-4 text-sm text-neutral-500">
          {t.tooLate}
          {phone ? `: ${phone}` : ""}.
        </p>
      ) : (
        <form action={cancelBooking} className="mt-4">
          <input type="hidden" name="token" value={token} />
          <button className="rounded-full border border-red-300 px-6 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50">
            {t.cancel}
          </button>
        </form>
      )}
    </Shell>
  );
}
