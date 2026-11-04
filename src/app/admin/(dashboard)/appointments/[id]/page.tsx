import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { formatDuration, formatEur } from "@/lib/format";
import { msUntil } from "@/lib/time";
import { ConfirmButton } from "@/components/confirm-button";
import { AdminRescheduleForm } from "@/components/admin-reschedule-form";
import { saveAdminNote, setAppointmentStatus } from "../actions";
import { statusClass, statusLabel } from "../status";

export const dynamic = "force-dynamic";

const TZ = "Europe/Berlin";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: {
      stylist: { select: { id: true, name: true } },
      items: true,
      review: { select: { rating: true, status: true } },
    },
  });
  if (!a) notFound();

  const serviceIds = a.items.map((i) => i.serviceId).filter((s): s is string => Boolean(s));
  const [barbers, history] = await Promise.all([
    prisma.stylist.findMany({
      where: {
        isActive: true,
        AND: serviceIds.map((serviceId) => ({ services: { some: { serviceId } } })),
      },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    a.customerEmail || a.customerPhone
      ? prisma.appointment.findMany({
          where: {
            id: { not: a.id },
            OR: [
              ...(a.customerEmail ? [{ customerEmail: a.customerEmail }] : []),
              ...(a.customerPhone ? [{ customerPhone: a.customerPhone }] : []),
            ],
          },
          orderBy: { startAt: "desc" },
          take: 8,
          include: { stylist: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const start = DateTime.fromJSDate(a.startAt).setZone(TZ).setLocale("de");
  const end = DateTime.fromJSDate(a.endAt).setZone(TZ);
  const active = a.status === "PENDING" || a.status === "CONFIRMED";
  const started = msUntil(a.startAt) <= 0;
  // Keep the current barber selectable even if their service list changed since.
  const barberOptions = barbers.some((b) => b.id === a.stylist.id) ? barbers : [a.stylist, ...barbers];
  const visits = history.filter((h) => h.status === "COMPLETED").length;
  const noShows = history.filter((h) => h.status === "NO_SHOW").length;
  const card = "rounded-2xl border border-neutral-200 bg-white p-5";
  const btn = "rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100";

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/appointments" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Termine
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {start.toFormat("cccc, d. LLLL")} · {start.toFormat("HH:mm")}–{end.toFormat("HH:mm")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            bei {a.stylist.name} · {formatDuration(a.totalDurationMinutes)} ·{" "}
            {a.source === "ADMIN" ? "im Salon eingetragen" : "online gebucht"} am{" "}
            {DateTime.fromJSDate(a.createdAt).setZone(TZ).toFormat("dd.MM.yyyy, HH:mm")}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${statusClass[a.status] ?? ""}`}>
          {statusLabel[a.status] ?? a.status}
        </span>
      </div>

      {a.customerNote && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Anmerkung der Kund:in</div>
          <p className="mt-1 whitespace-pre-line text-sm text-amber-950">{a.customerNote}</p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <section className={card}>
          <h2 className="font-semibold">Kund:in</h2>
          <p className="mt-2 text-lg">{a.customerName}</p>
          <div className="mt-2 space-y-1 text-sm">
            {a.customerPhone && (
              <a href={`tel:${a.customerPhone.replace(/[^\d+]/g, "")}`} className="block text-orange-700 hover:underline">
                📞 {a.customerPhone}
              </a>
            )}
            {a.customerEmail && (
              <a href={`mailto:${a.customerEmail}`} className="block break-all text-orange-700 hover:underline">
                ✉️ {a.customerEmail}
              </a>
            )}
            <p className="text-neutral-500">Sprache: {a.locale === "en" ? "Englisch" : "Deutsch"}</p>
            {(visits > 0 || noShows > 0) && (
              <p className="text-neutral-500">
                {visits} frühere Besuche{noShows > 0 && <span className="text-orange-700"> · {noShows}× nicht erschienen</span>}
              </p>
            )}
          </div>
        </section>

        <section className={card}>
          <h2 className="font-semibold">Leistungen</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {a.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.nameSnapshot}
                  {i.variantLabelSnapshot && i.variantLabelSnapshot !== "Standard" ? ` (${i.variantLabelSnapshot})` : ""}
                </span>
                <span className="shrink-0 text-neutral-500">{formatEur(i.priceCentsSnapshot)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-neutral-100 pt-2 text-sm font-medium">
            Gesamt: {a.priceIsFrom ? "ab " : ""}
            {formatEur(a.totalPriceCents)}
          </p>
          {a.review && (
            <p className="mt-2 text-sm text-neutral-500">
              Bewertung: {"★".repeat(a.review.rating)} ({a.review.status === "PUBLISHED" ? "veröffentlicht" : "noch nicht freigegeben"})
            </p>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className="font-semibold">Aktionen</h2>
        <div className="mt-3 space-y-4">
          {active && (
            <AdminRescheduleForm
              appointmentId={a.id}
              currentStylistId={a.stylist.id}
              currentDate={start.toISODate()!}
              barbers={barberOptions}
              customerEmail={a.customerEmail}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {active && started && (
              <>
                <StatusForm id={a.id} status="COMPLETED" className={btn}>
                  ✓ Erledigt
                </StatusForm>
                <StatusForm id={a.id} status="NO_SHOW" className={btn}>
                  Nicht erschienen
                </StatusForm>
              </>
            )}
            {(a.status === "COMPLETED" || a.status === "NO_SHOW") && (
              <StatusForm id={a.id} status="CONFIRMED" className={btn}>
                ↺ Status zurücksetzen
              </StatusForm>
            )}
          </div>
          {active && (
            <form action={setAppointmentStatus} className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value="CANCELLED" />
              {a.customerEmail && !started && (
                <label className="flex items-center gap-2 text-sm text-neutral-600">
                  <input type="checkbox" name="notify" value="1" defaultChecked />
                  Absage per E-Mail schicken
                </label>
              )}
              {/* Unchecked checkbox sends nothing; "0" marks "don't notify" explicitly. */}
              {(!a.customerEmail || started) && <input type="hidden" name="notify" value="0" />}
              <ConfirmButton
                message={`Termin von ${a.customerName} am ${start.toFormat("dd.MM.")} um ${start.toFormat("HH:mm")} wirklich stornieren?`}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Termin stornieren
              </ConfirmButton>
            </form>
          )}
          {!active && a.status === "CANCELLED" && (
            <p className="text-sm text-neutral-500">Dieser Termin ist storniert. Die Zeit ist wieder frei.</p>
          )}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Interne Notiz</h2>
        <p className="mt-1 text-xs text-neutral-500">Nur im Adminbereich sichtbar, z. B. „Kunde kommt 10 Min später“.</p>
        <form action={saveAdminNote} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={a.id} />
          <textarea
            name="adminNote"
            defaultValue={a.adminNote ?? ""}
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Notiz speichern
          </button>
        </form>
      </section>

      {history.length > 0 && (
        <section className={card}>
          <h2 className="font-semibold">Weitere Termine dieser Kund:in</h2>
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/admin/appointments/${h.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-orange-700">
                  <span>
                    {DateTime.fromJSDate(h.startAt).setZone(TZ).setLocale("de").toFormat("ccc dd.MM.yyyy, HH:mm")} · {h.stylist.name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[h.status] ?? ""}`}>
                    {statusLabel[h.status] ?? h.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatusForm({
  id,
  status,
  className,
  children,
}: {
  id: string;
  status: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={className}>{children}</button>
    </form>
  );
}
