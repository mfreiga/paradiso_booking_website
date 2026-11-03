import { prisma } from "@/lib/prisma";
import { ReviewForm } from "@/components/review-form";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { isPast } from "@/lib/time";
import { CustomerShell } from "@/components/customer-shell";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bewerten", robots: { index: false } };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale = await getLocale();
  const t = dict[locale].review;
  const appt = await prisma.appointment.findUnique({
    where: { reviewToken: token },
    include: { stylist: { select: { name: true } }, review: true },
  });

  if (!appt) {
    return (
      <CustomerShell locale={locale}>
        <p className="text-center text-neutral-400">{t.invalid}</p>
      </CustomerShell>
    );
  }
  if (appt.review) {
    return (
      <CustomerShell locale={locale}>
        <p className="rounded-lg bg-green-500/10 p-4 text-center text-sm text-green-400">
          {t.already}
        </p>
      </CustomerShell>
    );
  }
  if (appt.status === "CANCELLED") {
    return (
      <CustomerShell locale={locale}>
        <p className="text-center text-neutral-400">{t.cancelledNo}</p>
      </CustomerShell>
    );
  }
  const past = appt.status === "COMPLETED" || isPast(appt.startAt);
  if (!past) {
    return (
      <CustomerShell locale={locale}>
        <p className="text-center text-neutral-400">{t.tooEarly}</p>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell locale={locale}>
      <h2 className="text-xl font-semibold">{t.title}</h2>
      <div className="mt-4">
        <ReviewForm token={token} barberName={appt.stylist.name} locale={locale} />
      </div>
    </CustomerShell>
  );
}
