import { prisma } from "@/lib/prisma";
import { ReviewForm } from "@/components/review-form";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

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
      <Shell>
        <p className="text-center text-neutral-600">{t.invalid}</p>
      </Shell>
    );
  }
  if (appt.review) {
    return (
      <Shell>
        <p className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
          {t.already}
        </p>
      </Shell>
    );
  }
  if (appt.status === "CANCELLED") {
    return (
      <Shell>
        <p className="text-center text-neutral-600">{t.cancelledNo}</p>
      </Shell>
    );
  }
  const past = appt.status === "COMPLETED" || appt.startAt.getTime() < Date.now();
  if (!past) {
    return (
      <Shell>
        <p className="text-center text-neutral-600">{t.tooEarly}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h2 className="text-xl font-semibold">{t.title}</h2>
      <div className="mt-4">
        <ReviewForm token={token} barberName={appt.stylist.name} locale={locale} />
      </div>
    </Shell>
  );
}
