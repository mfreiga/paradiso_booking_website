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

  const appts = await prisma.appointment.findMany({
    where: {
      startAt: { gte: weekStart.toUTC().toJSDate(), lt: weekEnd.toUTC().toJSDate() },
    },
    orderBy: { startAt: "asc" },
    include: { stylist: { select: { name: true } }, items: true },
  });

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
          const isToday = day.hasSame(today, "day");
          return (
            <div key={day.toISODate()} className="min-w-[170px] flex-1">
              <div
                className={`mb-2 rounded-lg px-2 py-1 text-center text-sm font-medium ${isToday ? "bg-orange-100 text-orange-800" : "bg-neutral-100 text-neutral-600"}`}
              >
                {DAY_LABELS[day.weekday - 1]} {day.toFormat("dd.MM.")}
              </div>
              <div className="space-y-2">
                {list.length === 0 && (
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
