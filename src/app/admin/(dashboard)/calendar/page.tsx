import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const TZ = "Europe/Berlin";
const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const statusClass: Record<string, string> = {
  PENDING: "border-amber-300 bg-amber-50",
  CONFIRMED: "border-green-300 bg-green-50",
  COMPLETED: "border-neutral-300 bg-neutral-100",
  CANCELLED: "border-red-200 bg-red-50 opacity-50",
  NO_SHOW: "border-orange-300 bg-orange-50",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const parsed = sp.week ? DateTime.fromISO(sp.week, { zone: TZ }) : null;
  const base = parsed?.isValid ? parsed : DateTime.now().setZone(TZ);
  const weekStart = base.startOf("week");
  const weekEnd = weekStart.plus({ days: 7 });

  const [appts, offs, activeStylists] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startAt: { gte: weekStart.toUTC().toJSDate(), lt: weekEnd.toUTC().toJSDate() },
      },
      orderBy: { startAt: "asc" },
      include: { stylist: { select: { name: true } }, items: true },
    }),
    prisma.timeOff.findMany({
      where: {
        startAt: { lt: weekEnd.toUTC().toJSDate() },
        endAt: { gt: weekStart.toUTC().toJSDate() },
      },
      orderBy: { startAt: "asc" },
      include: { stylist: { select: { name: true } } },
    }),
    prisma.stylist.count({ where: { isActive: true } }),
  ]);

  /** The part of a time-off block that falls on `day`, as a label, or null. */
  const offLabel = (o: (typeof offs)[number], day: DateTime) => {
    const s = DateTime.max(DateTime.fromJSDate(o.startAt).setZone(TZ), day.startOf("day"));
    const e = DateTime.min(DateTime.fromJSDate(o.endAt).setZone(TZ), day.plus({ days: 1 }).startOf("day"));
    if (e <= s) return null;
    return e.diff(s, "hours").hours >= 24 ? "ganztägig" : `${s.toFormat("HH:mm")}–${e.hasSame(s, "day") ? e.toFormat("HH:mm") : "24:00"}`;
  };

  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));
  const today = DateTime.now().setZone(TZ);
  const fmtTime = (d: Date) => DateTime.fromJSDate(d).setZone(TZ).toFormat("HH:mm");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kalender</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Woche vom {weekStart.toFormat("dd.MM.")} –{" "}
            {weekStart.plus({ days: 6 }).toFormat("dd.MM.yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/admin/calendar?week=${weekStart.minus({ weeks: 1 }).toISODate()}`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100"
          >
            ←
          </Link>
          <Link
            href="/admin/calendar"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100"
          >
            Heute
          </Link>
          <Link
            href={`/admin/calendar?week=${weekStart.plus({ weeks: 1 }).toISODate()}`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100"
          >
            →
          </Link>
        </div>
      </div>

      <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
        {days.map((day) => {
          const list = appts.filter((a) =>
            DateTime.fromJSDate(a.startAt).setZone(TZ).hasSame(day, "day"),
          );
          // Same block for several barbers (e.g. salon closed) → one line.
          const grouped = new Map<string, { key: string; names: string[]; label: string; reason: string | null }>();
          for (const o of offs) {
            const label = offLabel(o, day);
            if (!label) continue;
            const key = `${o.startAt.toISOString()}|${o.endAt.toISOString()}|${o.reason ?? ""}`;
            const g = grouped.get(key) ?? { key, names: [], label, reason: o.reason };
            g.names.push(o.stylist.name);
            grouped.set(key, g);
          }
          const dayOffs = [...grouped.values()].map((g) => ({
            ...g,
            who: g.names.length === activeStylists && activeStylists > 1 ? "Salon geschlossen" : g.names.join(", "),
          }));
          const isToday = day.hasSame(today, "day");
          return (
            <div key={day.toISODate()} className="min-w-[170px] flex-1">
              <div
                className={`mb-2 rounded-lg px-2 py-1 text-center text-sm font-medium ${isToday ? "bg-orange-100 text-orange-800" : "bg-neutral-100 text-neutral-600"}`}
              >
                {DAY_LABELS[day.weekday - 1]} {day.toFormat("dd.MM.")}
              </div>
              <div className="space-y-2">
                {dayOffs.map((g) => (
                  <Link
                    key={g.key}
                    href="/admin/time-off"
                    className="block rounded-lg border border-dashed border-neutral-300 bg-neutral-100 p-2 text-xs text-neutral-500 hover:bg-neutral-200"
                  >
                    <div className="font-medium">🚫 {g.who} · {g.label}</div>
                    {g.reason && <div>{g.reason}</div>}
                  </Link>
                ))}
                {list.length === 0 && dayOffs.length === 0 && (
                  <p className="px-1 text-center text-xs text-neutral-300">–</p>
                )}
                {list.map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-lg border p-2 text-xs ${statusClass[a.status] ?? "border-neutral-200"}`}
                  >
                    <div className="font-medium">
                      {fmtTime(a.startAt)} · {a.stylist.name}
                    </div>
                    <div className="text-neutral-600">{a.customerName}</div>
                    <div className="text-neutral-500">
                      {a.items.map((i) => i.nameSnapshot).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
