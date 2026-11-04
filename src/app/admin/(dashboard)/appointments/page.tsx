import Link from "next/link";
import { DateTime } from "luxon";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { formatDuration, formatEur } from "@/lib/format";
import { setAppointmentStatus } from "./actions";
import { statusClass, statusLabel } from "./status";

export const dynamic = "force-dynamic";

const TZ = "Europe/Berlin";
const VIEWS = [
  { key: "upcoming", label: "Kommend" },
  { key: "past", label: "Vergangen" },
  { key: "cancelled", label: "Storniert" },
  { key: "all", label: "Alle" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function AppointmentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; barber?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "upcoming";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const now = new Date();

  const where: Prisma.AppointmentWhereInput = {
    ...(sp.barber ? { stylistId: sp.barber } : {}),
    ...(view === "upcoming" && { endAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } }),
    ...(view === "past" && { startAt: { lt: now }, status: { not: "CANCELLED" } }),
    ...(view === "cancelled" && { status: "CANCELLED" }),
    ...(q && {
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q.toLowerCase() } },
        { customerPhone: { contains: q } },
      ],
    }),
  };

  const [appointments, barbers] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startAt: view === "upcoming" ? "asc" : "desc" },
      take: 200,
      include: { stylist: { select: { name: true } }, items: { select: { nameSnapshot: true, variantLabelSnapshot: true } } },
    }),
    prisma.stylist.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true, isActive: true } }),
  ]);

  // Group by day (shop time) for a scannable list.
  const days = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const key = DateTime.fromJSDate(a.startAt).setZone(TZ).toISODate()!;
    days.set(key, [...(days.get(key) ?? []), a]);
  }
  const todayKey = DateTime.now().setZone(TZ).toISODate();

  const href = (p: Partial<{ view: string; q: string; barber: string }>) => {
    const merged = { view, q, barber: sp.barber ?? "", ...p };
    const s = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]);
    return `/admin/appointments${s.size ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"}`;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Termine</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {appointments.length === 1 ? "1 Termin" : `${appointments.length} Termine`}
            {appointments.length === 200 && " (die ersten 200)"}
          </p>
        </div>
        <Link
          href="/admin/appointments/new"
          className="shrink-0 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          + Neuer Termin
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link key={v.key} href={href({ view: v.key })} className={chip(view === v.key)}>
            {v.label}
          </Link>
        ))}
        <form action="/admin/appointments" className="ml-auto flex w-full gap-2 sm:w-auto">
          <input type="hidden" name="view" value={view} />
          {sp.barber && <input type="hidden" name="barber" value={sp.barber} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, Telefon oder E-Mail"
            aria-label="Termine durchsuchen"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm sm:w-64"
          />
          <button className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100">Suchen</button>
        </form>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link href={href({ barber: "" })} className={chip(!sp.barber)}>
          Alle Friseure
        </Link>
        {barbers.map((b) => (
          <Link key={b.id} href={href({ barber: b.id })} className={`${chip(sp.barber === b.id)} ${b.isActive ? "" : "opacity-60"}`}>
            {b.name}
          </Link>
        ))}
      </div>

      {appointments.length === 0 && (
        <p className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
          {q ? `Nichts gefunden für „${q}“.` : "Keine Termine in dieser Ansicht."}
        </p>
      )}

      <div className="mt-6 space-y-5">
        {[...days.entries()].map(([day, list]) => (
          <section key={day} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className={`flex items-center justify-between border-b border-neutral-100 px-4 py-2 ${day === todayKey ? "bg-orange-50" : "bg-neutral-50"}`}>
              <span className="font-medium">
                {day === todayKey ? "Heute · " : ""}
                {DateTime.fromISO(day, { zone: TZ }).setLocale("de").toFormat("cccc, d. LLLL yyyy")}
              </span>
              <Link href={`/admin/calendar?view=day&date=${day}`} className="text-xs text-neutral-500 hover:text-neutral-900">
                Tagesansicht →
              </Link>
            </div>
            <ul className="divide-y divide-neutral-100">
              {list.map((a) => {
                const active = a.status === "PENDING" || a.status === "CONFIRMED";
                const started = a.startAt <= now;
                return (
                  <li key={a.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${a.status === "CANCELLED" ? "opacity-60" : ""}`}>
                    <Link href={`/admin/appointments/${a.id}`} className="min-w-0 flex-1 hover:text-orange-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {DateTime.fromJSDate(a.startAt).setZone(TZ).toFormat("HH:mm")}
                        </span>
                        <span className="font-medium">{a.customerName}</span>
                        <span className="text-sm text-neutral-500">bei {a.stylist.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[a.status] ?? ""}`}>
                          {statusLabel[a.status] ?? a.status}
                        </span>
                        {a.source === "ADMIN" && <span className="text-xs text-neutral-400">im Salon eingetragen</span>}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {a.items
                          .map((i) => i.nameSnapshot + (i.variantLabelSnapshot && i.variantLabelSnapshot !== "Standard" ? ` (${i.variantLabelSnapshot})` : ""))
                          .join(", ")}{" "}
                        · {formatDuration(a.totalDurationMinutes)} · {a.priceIsFrom ? "ab " : ""}
                        {formatEur(a.totalPriceCents)}
                        {a.customerPhone && ` · ${a.customerPhone}`}
                      </div>
                      {a.customerNote && (
                        <div className="mt-1 line-clamp-2 rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900">💬 {a.customerNote}</div>
                      )}
                      {a.adminNote && <div className="mt-1 line-clamp-1 text-xs text-neutral-500">📝 {a.adminNote}</div>}
                    </Link>
                    {active && started && (
                      <div className="flex gap-1.5">
                        {(["COMPLETED", "NO_SHOW"] as const).map((s) => (
                          <form key={s} action={setAppointmentStatus}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="status" value={s} />
                            <button className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
                              {s === "COMPLETED" ? "Erledigt" : "Nicht da"}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
