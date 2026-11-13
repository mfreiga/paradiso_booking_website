import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { isOwner, requireStaff, stylistScope } from "@/lib/auth-guard";
import { formatEur } from "@/lib/format";
import { emailTransport } from "@/lib/email";
import { setAppointmentStatus } from "./appointments/actions";
import { msUntil } from "@/lib/time";

export const dynamic = "force-dynamic";

const TZ = "Europe/Berlin";
const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const ACTIVE = ["PENDING", "CONFIRMED"] as const;
const statusLabel: Record<string, string> = {
  PENDING: "offen",
  CONFIRMED: "bestätigt",
  COMPLETED: "erledigt",
  CANCELLED: "abgesagt",
  NO_SHOW: "nicht erschienen",
};
const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-neutral-200 text-neutral-600",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ nur?: string }>;
}) {
  const staff = await requireStaff();
  const owner = isOwner(staff);
  const scope = stylistScope(staff); // barbers: their own column only
  const { nur } = await searchParams;
  const now = DateTime.now().setZone(TZ);
  const todayStart = now.startOf("day");
  const weekStart = now.startOf("week");
  const utc = (d: DateTime) => d.toUTC().toJSDate();

  const [today, week, recent, offs, pendingReviews, unconfirmed, pushDevices] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...scope, startAt: { gte: utc(todayStart), lt: utc(todayStart.plus({ days: 1 })) } },
      orderBy: { startAt: "asc" },
      include: { stylist: { select: { name: true } }, items: { select: { nameSnapshot: true } } },
    }),
    prisma.appointment.findMany({
      where: {
        ...scope,
        startAt: { gte: utc(weekStart), lt: utc(weekStart.plus({ days: 7 })) },
        status: { in: [...ACTIVE, "COMPLETED"] },
      },
      select: { startAt: true, totalPriceCents: true },
    }),
    prisma.appointment.findMany({
      where: { ...scope, source: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { stylist: { select: { name: true } } },
    }),
    prisma.timeOff.findMany({
      where: { ...scope, endAt: { gt: new Date() } },
      orderBy: { startAt: "asc" },
      take: 20,
      include: { stylist: { select: { name: true } } },
    }),
    owner ? prisma.review.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    // Online bookings of the last 2 weeks whose confirmation email never went out.
    prisma.appointment.count({
      where: {
        ...scope,
        source: "CUSTOMER",
        customerEmail: { not: "" },
        confirmationSentAt: null,
        createdAt: { gte: utc(now.minus({ days: 14 })) },
        startAt: { gte: utc(now) },
      },
    }),
    // This person's own devices (shared owner login = devices without an account).
    prisma.pushSubscription.count({ where: { userId: staff.isEnvAdmin ? null : staff.id } }),
  ]);

  const z = (d: Date) => DateTime.fromJSDate(d).setZone(TZ);
  const hm = (d: Date) => z(d).toFormat("HH:mm");
  const todayActive = today.filter((a) => (ACTIVE as readonly string[]).includes(a.status) || a.status === "COMPLETED");
  const upNext = today.find((a) => (ACTIVE as readonly string[]).includes(a.status) && a.endAt > new Date());
  const weekRevenue = week.reduce((s, a) => s + a.totalPriceCents, 0);
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = weekStart.plus({ days: i });
    return { d, n: week.filter((a) => z(a.startAt).hasSame(d, "day")).length };
  });

  // Same block for several barbers (e.g. salon closed) → one line.
  const blockGroups = new Map<string, { names: string[]; startAt: Date; endAt: Date; reason: string | null }>();
  for (const o of offs) {
    const key = `${o.startAt.toISOString()}|${o.endAt.toISOString()}|${o.reason ?? ""}`;
    const g = blockGroups.get(key) ?? { names: [], startAt: o.startAt, endAt: o.endAt, reason: o.reason };
    g.names.push(o.stylist.name);
    blockGroups.set(key, g);
  }
  const blocks = [...blockGroups.values()].slice(0, 4);

  const kpis = [
    { label: "Termine heute", value: String(todayActive.length), href: `/admin/calendar?view=day&date=${todayStart.toISODate()}` },
    { label: "Diese Woche", value: String(week.length), href: "/admin/calendar" },
    { label: owner ? "Umsatz Woche (ca.)" : "Mein Umsatz Woche (ca.)", value: formatEur(weekRevenue), href: "/admin/appointments" },
    ...(owner ? [{ label: "Bewertungen offen", value: String(pendingReviews), href: "/admin/reviews" }] : []),
  ];
  const card = "rounded-2xl border border-neutral-200 bg-white p-5";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{owner ? "Übersicht" : `Hallo ${staff.name}`}</h1>
          <p className="mt-1 text-sm text-neutral-500">{now.setLocale("de").toFormat("cccc, d. LLLL")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/appointments/new" className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600">
            + Termin eintragen
          </Link>
          <Link href="/admin/time-off" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-100">
            Zeit blockieren
          </Link>
          <Link href="/admin/calendar" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-100">
            Kalender
          </Link>
        </div>
      </div>

      {emailTransport() !== "log" && unconfirmed > 0 && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {unconfirmed === 1 ? "Bei 1 Buchung" : `Bei ${unconfirmed} Buchungen`} ist die Bestätigungs-E-Mail nicht rausgegangen. Bitte die E-Mail-Einstellungen prüfen
          und die Kund:innen kurz anrufen oder anschreiben (unter{" "}
          <Link href="/admin/appointments" className="underline">
            Termine
          </Link>
          ).
        </p>
      )}
      {nur === "inhaber" && (
        <p className="rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-600">Diese Seite kann nur der Inhaber öffnen.</p>
      )}
      {!owner && !staff.stylistId && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Dein Zugang ist noch keinem Friseur-Kalender zugeordnet. Bitte beim Inhaber melden.
        </p>
      )}
      {pushDevices === 0 && (
        <p className="rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-600">
          Tipp: Unter{" "}
          <Link href="/admin/account" className="underline">
            Mein Konto
          </Link>{" "}
          kannst du die App aufs Handy holen und Benachrichtigungen einschalten, dann siehst du neue Buchungen sofort.
        </p>
      )}
      {owner && emailTransport() === "log" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          E-Mails sind noch nicht eingerichtet: Kund:innen bekommen keine Bestätigung und du keine Info über neue Buchungen.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-2xl border border-neutral-200 bg-white p-4 transition hover:shadow">
            <div className="text-2xl font-semibold">{k.value}</div>
            <div className="mt-0.5 text-sm text-neutral-500">{k.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today */}
        <section className={`${card} lg:col-span-2`}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Heute</h2>
            <Link href={`/admin/calendar?view=day&date=${todayStart.toISODate()}`} className="text-sm text-neutral-500 hover:text-neutral-900">
              Tagesansicht →
            </Link>
          </div>
          {upNext && (
            <p className="mt-2 text-sm text-neutral-600">
              Als Nächstes: <strong>{hm(upNext.startAt)}</strong> {upNext.customerName} bei {upNext.stylist.name}
            </p>
          )}
          <ul className="mt-3 divide-y divide-neutral-100">
            {today.length === 0 && <li className="py-3 text-sm text-neutral-400">Heute keine Termine.</li>}
            {today.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${a.status === "CANCELLED" ? "opacity-50" : ""}`}>
                <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                  {hm(a.startAt)}–{hm(a.endAt)}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{a.customerName}</span>
                  <span className="text-neutral-500"> · {a.stylist.name} · {a.items.map((i) => i.nameSnapshot).join(", ")}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[a.status] ?? ""}`}>{statusLabel[a.status] ?? a.status}</span>
                {(ACTIVE as readonly string[]).includes(a.status) && a.startAt <= new Date() && (
                  <div className="flex gap-1">
                    {(["COMPLETED", "NO_SHOW"] as const).map((s) => (
                      <form key={s} action={setAppointmentStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value={s} />
                        <button className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100">
                          {s === "COMPLETED" ? "Erledigt" : "Nicht da"}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Newest online bookings */}
        <section className={card}>
          <h2 className="text-lg font-semibold">Neu gebucht</h2>
          <ul className="mt-3 space-y-2.5">
            {recent.length === 0 && <li className="text-sm text-neutral-400">Noch keine Online-Buchungen.</li>}
            {recent.map((a) => {
              const fresh = msUntil(a.createdAt) > -24 * 3600_000;
              return (
                <li key={a.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.customerName}</span>
                    {fresh && <span className="rounded-full bg-orange-100 px-1.5 text-[10px] font-semibold uppercase text-orange-700">neu</span>}
                    {a.status === "CANCELLED" && <span className="text-xs text-red-600">abgesagt</span>}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {z(a.startAt).setLocale("de").toFormat("ccc dd.MM., HH:mm")} · {a.stylist.name}
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/admin/appointments" className="mt-3 inline-block text-sm text-neutral-500 hover:text-neutral-900">
            Alle Termine →
          </Link>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* This week */}
        <section className={`${card} lg:col-span-2`}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Diese Woche</h2>
            <Link href="/admin/calendar" className="text-sm text-neutral-500 hover:text-neutral-900">
              Wochenansicht →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {perDay.map(({ d, n }) => {
              const isToday = d.hasSame(now, "day");
              return (
                <Link
                  key={d.toISODate()}
                  href={`/admin/calendar?view=day&date=${d.toISODate()}`}
                  className={`rounded-xl border p-2 text-center transition hover:border-orange-400 ${isToday ? "border-orange-300 bg-orange-50" : "border-neutral-200"} ${d < todayStart ? "opacity-50" : ""}`}
                >
                  <div className="text-xs text-neutral-500">{DAY_LABELS[d.weekday - 1]}</div>
                  <div className="text-sm font-medium">{d.toFormat("dd.")}</div>
                  <div className={`mt-1 text-lg font-semibold ${n ? "" : "text-neutral-300"}`}>{n}</div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Blocked time */}
        <section className={card}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Blockiert</h2>
            <Link href="/admin/time-off" className="text-sm text-neutral-500 hover:text-neutral-900">
              Verwalten →
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {blocks.length === 0 && <li className="text-neutral-400">Nichts geplant.</li>}
            {blocks.map((b) => (
              <li key={`${b.startAt.toISOString()}${b.reason}`}>
                <div className="font-medium">
                  {z(b.startAt).setLocale("de").toFormat("ccc dd.MM.")}
                  {z(b.startAt).toFormat("HH:mm") !== "00:00" && `, ${hm(b.startAt)}–${hm(b.endAt)}`}
                </div>
                <div className="text-xs text-neutral-500">
                  {b.names.join(", ")}
                  {b.reason ? ` · ${b.reason}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
