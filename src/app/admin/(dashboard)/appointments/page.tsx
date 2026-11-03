import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { formatDuration, formatEur } from "@/lib/format";
import { setAppointmentStatus } from "./actions";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const TZ = "Europe/Berlin";
const statusLabel: Record<string, string> = {
  PENDING: "Offen",
  CONFIRMED: "Bestätigt",
  COMPLETED: "Erledigt",
  CANCELLED: "Abgesagt",
  NO_SHOW: "Nicht erschienen",
};
const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-neutral-200 text-neutral-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-orange-100 text-orange-800",
};
const TABS = [
  ["upcoming", "Kommend"],
  ["past", "Vergangen"],
  ["cancelled", "Abgesagt"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function AppointmentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; barber?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : "upcoming";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const startOfToday = DateTime.now().setZone(TZ).startOf("day").toUTC().toJSDate();

  const where: Prisma.AppointmentWhereInput = {
    ...(sp.barber ? { stylistId: sp.barber } : {}),
    ...(tab === "upcoming"
      ? { startAt: { gte: startOfToday }, status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] } }
      : tab === "past"
        ? { startAt: { lt: startOfToday }, status: { not: "CANCELLED" } }
        : { status: "CANCELLED" }),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q } },
          ],
        }
      : {}),
  };

  const [appts, barbers] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startAt: tab === "upcoming" ? "asc" : "desc" },
      take: 200,
      include: { items: true, stylist: { select: { name: true } } },
    }),
    prisma.stylist.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const days = new Map<string, typeof appts>();
  for (const a of appts) {
    const key = DateTime.fromJSDate(a.startAt).setZone(TZ).toISODate()!;
    days.set(key, [...(days.get(key) ?? []), a]);
  }
  const link = (p: { tab?: string; q?: string; barber?: string }) => {
    const u = new URLSearchParams();
    const m = { tab, q, barber: sp.barber, ...p };
    if (m.tab && m.tab !== "upcoming") u.set("tab", m.tab);
    if (m.q) u.set("q", m.q);
    if (m.barber) u.set("barber", m.barber);
    return `/admin/appointments${u.size ? `?${u}` : ""}`;
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"}`;
  const hm = (d: Date) => DateTime.fromJSDate(d).setZone(TZ).toFormat("HH:mm");
  const btn = "rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Termine</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {appts.length === 200 ? "Die neuesten 200" : appts.length} {appts.length === 1 ? "Termin" : "Termine"}
          </p>
        </div>
        <Link href="/admin/appointments/new" className="shrink-0 rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
          + Termin eintragen
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {TABS.map(([k, label]) => (
          <Link key={k} href={link({ tab: k })} className={chip(tab === k)}>
            {label}
          </Link>
        ))}
        <form action="/admin/appointments" className="ml-auto flex w-full gap-2 sm:w-auto">
          {tab !== "upcoming" && <input type="hidden" name="tab" value={tab} />}
          {sp.barber && <input type="hidden" name="barber" value={sp.barber} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, E-Mail oder Telefon"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm sm:w-64"
          />
          <button className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100">Suchen</button>
        </form>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Link href={link({ barber: undefined })} className={chip(!sp.barber)}>
          Alle
        </Link>
        {barbers.map((b) => (
          <Link key={b.id} href={link({ barber: b.id })} className={chip(sp.barber === b.id)}>
            {b.name}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {appts.length === 0 && <p className="text-sm text-neutral-400">{q ? `Nichts gefunden für „${q}“.` : "Keine Termine."}</p>}
        {[...days].map(([day, list]) => (
          <section key={day} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700">
              {DateTime.fromISO(day, { zone: TZ }).setLocale("de").toFormat("cccc, d. LLLL yyyy")}
            </div>
            <ul className="divide-y divide-neutral-100">
              {list.map((a) => {
                const active = a.status === "PENDING" || a.status === "CONFIRMED";
                const started = a.startAt <= new Date();
                return (
                  <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {hm(a.startAt)}–{hm(a.endAt)}
                        </span>
                        <span className="text-sm text-neutral-600">{a.stylist.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[a.status] ?? ""}`}>{statusLabel[a.status] ?? a.status}</span>
                        {a.source === "ADMIN" && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">eingetragen</span>}
                      </div>
                      <div className="mt-0.5 text-sm">
                        <span className="font-medium">{a.customerName}</span>
                        <span className="text-neutral-500">
                          {a.customerEmail && (
                            <>
                              {" · "}
                              <a href={`mailto:${a.customerEmail}`} className="hover:underline">
                                {a.customerEmail}
                              </a>
                            </>
                          )}
                          {a.customerPhone && (
                            <>
                              {" · "}
                              <a href={`tel:${a.customerPhone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                                {a.customerPhone}
                              </a>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="text-sm text-neutral-500">
                        {a.items.map((i) => i.nameSnapshot + (i.variantLabelSnapshot && i.variantLabelSnapshot !== "Standard" ? ` (${i.variantLabelSnapshot})` : "")).join(", ")} ·{" "}
                        {a.priceIsFrom ? "ab " : ""}
                        {formatEur(a.totalPriceCents)} · {formatDuration(a.totalDurationMinutes)}
                      </div>
                      {a.customerNote && <div className="mt-1 text-sm italic text-neutral-600">„{a.customerNote}“</div>}
                    </div>
                    {active && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {started ? (
                          <>
                            <StatusButton id={a.id} status="COMPLETED" label="Erledigt" />
                            <StatusButton id={a.id} status="NO_SHOW" label="Nicht da" />
                          </>
                        ) : (
                          <Link href={`/admin/appointments/${a.id}/move`} className={btn}>
                            Verschieben
                          </Link>
                        )}
                        {/* Cancelling emails the customer, so it takes a second tap. */}
                        <details className="group relative">
                          <summary className={`${btn} cursor-pointer list-none text-red-700 [&::-webkit-details-marker]:hidden`}>Absagen</summary>
                          <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg">
                            <p>{a.customerEmail ? "Termin absagen? Die Person bekommt eine E-Mail." : "Termin absagen?"}</p>
                            <form action={setAppointmentStatus} className="mt-2">
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value="CANCELLED" />
                              <button className="rounded bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700">Ja, absagen</button>
                            </form>
                          </div>
                        </details>
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

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">{label}</button>
    </form>
  );
}
