import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { isOwner, requireStaff } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const TZ = "Europe/Berlin";
const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const statusClass: Record<string, string> = {
  PENDING: "border-amber-300 bg-amber-50",
  CONFIRMED: "border-green-300 bg-green-50",
  COMPLETED: "border-neutral-300 bg-neutral-100",
  CANCELLED: "border-red-200 bg-red-50 opacity-50 line-through",
  NO_SHOW: "border-orange-300 bg-orange-50",
};
const PX_PER_MIN = 1.1;

type Search = { view?: string; week?: string; date?: string; barber?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requireStaff();
  const owner = isOwner(staff);
  const sp = await searchParams;
  const view = sp.view === "day" ? "day" : "week";
  const today = DateTime.now().setZone(TZ);
  const parse = (s?: string) => {
    const d = s ? DateTime.fromISO(s, { zone: TZ }) : null;
    return d?.isValid ? d : today;
  };
  const day = parse(sp.date ?? sp.week).startOf("day");
  const rangeStart = view === "day" ? day : day.startOf("week");
  const rangeEnd = rangeStart.plus({ days: view === "day" ? 1 : 7 });

  const stylists = await prisma.stylist.findMany({
    // Barbers only ever load their own column (not just hidden — never queried).
    where: { isActive: true, ...(owner ? {} : { id: staff.stylistId ?? "__none__" }) },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true, workingHours: true },
  });
  const shown = sp.barber ? stylists.filter((s) => s.id === sp.barber) : stylists;
  const shownIds = shown.map((s) => s.id);

  const [appts, offs] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        stylistId: { in: shownIds },
        startAt: { gte: rangeStart.toUTC().toJSDate(), lt: rangeEnd.toUTC().toJSDate() },
      },
      orderBy: { startAt: "asc" },
      include: { stylist: { select: { name: true } }, items: { select: { nameSnapshot: true } } },
    }),
    prisma.timeOff.findMany({
      where: {
        stylistId: { in: shownIds },
        startAt: { lt: rangeEnd.toUTC().toJSDate() },
        endAt: { gt: rangeStart.toUTC().toJSDate() },
      },
      orderBy: { startAt: "asc" },
      include: { stylist: { select: { name: true } } },
    }),
  ]);

  const z = (d: Date) => DateTime.fromJSDate(d).setZone(TZ);
  const hm = (d: Date) => z(d).toFormat("HH:mm");
  const href = (p: Search) => {
    const q = new URLSearchParams();
    const merged = { view, barber: sp.barber, ...p };
    if (merged.view === "day") q.set("view", "day");
    if (merged.view === "day" && merged.date) q.set("date", merged.date);
    if (merged.view !== "day" && merged.week) q.set("week", merged.week);
    if (merged.barber) q.set("barber", merged.barber);
    const s = q.toString();
    return `/admin/calendar${s ? `?${s}` : ""}`;
  };
  const step = view === "day" ? { days: 1 } : { weeks: 1 };
  const prev = rangeStart.minus(step).toISODate()!;
  const next = rangeStart.plus(step).toISODate()!;
  const nav = (iso: string) => (view === "day" ? href({ date: iso }) : href({ week: iso }));
  const btn = "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-100";
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"}`;

  /** The part of a time-off block that falls on `d` (minutes from midnight), or null. */
  const offSpan = (o: (typeof offs)[number], d: DateTime) => {
    const s = DateTime.max(z(o.startAt), d.startOf("day"));
    const e = DateTime.min(z(o.endAt), d.plus({ days: 1 }).startOf("day"));
    if (e <= s) return null;
    const startMin = s.hour * 60 + s.minute;
    const endMin = e.hasSame(s, "day") ? e.hour * 60 + e.minute : 1440;
    return { startMin, endMin, allDay: endMin - startMin >= 1440, label: endMin - startMin >= 1440 ? "ganztägig" : `${s.toFormat("HH:mm")}–${endMin === 1440 ? "24:00" : e.toFormat("HH:mm")}` };
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Kalender</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {view === "day"
              ? day.setLocale("de").toFormat("cccc, d. LLLL yyyy")
              : `Woche vom ${rangeStart.toFormat("dd.MM.")} bis ${rangeStart.plus({ days: 6 }).toFormat("dd.MM.yyyy")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/admin/appointments/new${view === "day" ? `?date=${day.toISODate()}${owner && sp.barber ? `&barber=${sp.barber}` : ""}` : ""}`}
            className="rounded-lg bg-orange-500 px-3 py-1.5 font-medium text-white hover:bg-orange-600"
          >
            + Termin
          </Link>
          <Link href="/admin/time-off" className={btn}>
            Zeit blockieren
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link href={nav(prev)} className={btn} aria-label="Zurück">
            ←
          </Link>
          <Link href={view === "day" ? href({ date: today.toISODate()! }) : href({ week: undefined })} className={btn}>
            Heute
          </Link>
          <Link href={nav(next)} className={btn} aria-label="Weiter">
            →
          </Link>
          <span className="mx-1 h-6 w-px bg-neutral-200" />
          <Link href={href({ view: "day", date: (view === "day" ? day : today).toISODate()! })} className={chip(view === "day")}>
            Tag
          </Link>
          <Link href={href({ view: "week", week: rangeStart.toISODate()! })} className={chip(view === "week")}>
            Woche
          </Link>
        </div>
        {owner && (
          <div className="flex flex-wrap gap-1.5">
            <Link href={href({ barber: undefined })} className={chip(!sp.barber)}>
              Alle
            </Link>
            {stylists.map((s) => (
              <Link key={s.id} href={href({ barber: s.id })} className={chip(sp.barber === s.id)}>
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {view === "week" ? (
        <div className="mt-6 grid gap-3 lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => rangeStart.plus({ days: i })).map((d) => {
            const list = appts.filter((a) => z(a.startAt).hasSame(d, "day"));
            const dayOffs = offs.flatMap((o) => {
              const span = offSpan(o, d);
              return span ? [{ o, span }] : [];
            });
            const isToday = d.hasSame(today, "day");
            return (
              <div key={d.toISODate()} className="min-w-0">
                <Link
                  href={href({ view: "day", date: d.toISODate()! })}
                  className={`mb-2 flex items-center justify-between rounded-lg px-2 py-1 text-sm font-medium hover:ring-1 hover:ring-neutral-300 ${isToday ? "bg-orange-100 text-orange-800" : "bg-neutral-100 text-neutral-600"}`}
                >
                  <span>
                    {DAY_LABELS[d.weekday - 1]} {d.toFormat("dd.MM.")}
                  </span>
                  <span className="text-xs font-normal">{list.filter((a) => a.status !== "CANCELLED").length || ""}</span>
                </Link>
                <div className="space-y-2">
                  {dayOffs.map(({ o, span }) => (
                    <Link key={o.id} href="/admin/time-off" className="block rounded-lg border border-dashed border-neutral-300 bg-neutral-100 p-2 text-xs text-neutral-500">
                      🚫 {o.stylist.name} · {span.label}
                      {o.reason ? ` · ${o.reason}` : ""}
                    </Link>
                  ))}
                  {list.length === 0 && dayOffs.length === 0 && <p className="px-1 text-xs text-neutral-300">frei</p>}
                  {list.map((a) => (
                    <div key={a.id} className={`rounded-lg border p-2 text-xs ${statusClass[a.status] ?? "border-neutral-200"}`}>
                      <div className="font-medium">
                        {hm(a.startAt)}–{hm(a.endAt)} · {a.stylist.name}
                      </div>
                      <div className="text-neutral-700">{a.customerName}</div>
                      <div className="text-neutral-500">{a.items.map((i) => i.nameSnapshot).join(", ")}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        dayView()
      )}
    </div>
  );

  // Day view: a time grid with one column per barber (md+), per-barber lists on phones.
  function dayView() {
    const weekday = day.weekday;
    const hoursToday = shown.flatMap((s) => s.workingHours.filter((w) => w.weekday === weekday));
    const minStart = Math.min(9 * 60, ...hoursToday.map((w) => w.startMinutes), ...appts.map((a) => z(a.startAt).hour * 60));
    const maxEnd = Math.max(19 * 60, ...hoursToday.map((w) => w.endMinutes), ...appts.map((a) => z(a.endAt).hour * 60 + z(a.endAt).minute));
    const gridStart = Math.floor(minStart / 60) * 60;
    const gridEnd = Math.ceil(maxEnd / 60) * 60;
    const height = (gridEnd - gridStart) * PX_PER_MIN;
    const hours = Array.from({ length: (gridEnd - gridStart) / 60 + 1 }, (_, i) => gridStart + i * 60);
    const nowMin = day.hasSame(today, "day") ? today.hour * 60 + today.minute : null;
    const top = (min: number) => (Math.max(min, gridStart) - gridStart) * PX_PER_MIN;
    const mins = (d: Date) => z(d).hour * 60 + z(d).minute;

    return (
      <>
        {/* Phones: one list per barber */}
        <div className="mt-6 space-y-4 md:hidden">
          {shown.map((s) => {
            const list = appts.filter((a) => a.stylistId === s.id);
            const blocks = offs.filter((o) => o.stylistId === s.id).flatMap((o) => {
              const span = offSpan(o, day);
              return span ? [{ o, span }] : [];
            });
            const works = s.workingHours.find((w) => w.weekday === weekday);
            return (
              <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-neutral-400">
                    {works ? `${String(Math.floor(works.startMinutes / 60)).padStart(2, "0")}:${String(works.startMinutes % 60).padStart(2, "0")}–${String(Math.floor(works.endMinutes / 60)).padStart(2, "0")}:${String(works.endMinutes % 60).padStart(2, "0")}` : "frei"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {blocks.map(({ o, span }) => (
                    <div key={o.id} className="rounded-lg border border-dashed border-neutral-300 bg-neutral-100 px-2 py-1.5 text-xs text-neutral-500">
                      🚫 {span.label}
                      {o.reason ? ` · ${o.reason}` : ""}
                    </div>
                  ))}
                  {list.length === 0 && blocks.length === 0 && <p className="text-xs text-neutral-300">Keine Termine</p>}
                  {list.map((a) => (
                    <div key={a.id} className={`rounded-lg border px-2 py-1.5 text-xs ${statusClass[a.status] ?? ""}`}>
                      <span className="font-medium">
                        {hm(a.startAt)}–{hm(a.endAt)}
                      </span>{" "}
                      · {a.customerName} · {a.items.map((i) => i.nameSnapshot).join(", ")}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* md+: time grid */}
        <div className="mt-6 hidden rounded-2xl border border-neutral-200 bg-white md:block">
          <div className="grid border-b border-neutral-200" style={{ gridTemplateColumns: `3.5rem repeat(${shown.length}, minmax(0, 1fr))` }}>
            <div />
            {shown.map((s) => (
              <div key={s.id} className="border-l border-neutral-200 px-2 py-2 text-center text-sm font-medium">
                {s.name}
              </div>
            ))}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `3.5rem repeat(${shown.length}, minmax(0, 1fr))`, height }}>
            {/* hour lines + labels */}
            {hours.map((h) => (
              <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-neutral-100" style={{ top: top(h) }}>
                <span className="absolute -top-2 left-1 bg-white px-1 text-[10px] text-neutral-400">{String(h / 60).padStart(2, "0")}:00</span>
              </div>
            ))}
            {nowMin !== null && nowMin >= gridStart && nowMin <= gridEnd && (
              <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-orange-500" style={{ top: top(nowMin) }} />
            )}
            <div />
            {shown.map((s) => {
              const works = s.workingHours.find((w) => w.weekday === weekday);
              return (
                <div key={s.id} className="relative border-l border-neutral-200">
                  {/* outside working hours = grey */}
                  {!works ? (
                    <div className="absolute inset-0 bg-neutral-100/80" />
                  ) : (
                    <>
                      <div className="absolute inset-x-0 top-0 bg-neutral-100/80" style={{ height: top(works.startMinutes) }} />
                      <div className="absolute inset-x-0 bottom-0 bg-neutral-100/80" style={{ top: top(works.endMinutes) }} />
                    </>
                  )}
                  {offs
                    .filter((o) => o.stylistId === s.id)
                    .flatMap((o) => {
                      const span = offSpan(o, day);
                      return span ? [{ o, span }] : [];
                    })
                    .map(({ o, span }) => (
                      <Link
                        key={o.id}
                        href="/admin/time-off"
                        className="absolute inset-x-1 overflow-hidden rounded-md border border-dashed border-neutral-400 bg-[repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5_6px,#e5e5e5_6px,#e5e5e5_12px)] p-1 text-[11px] text-neutral-600"
                        style={{ top: top(span.startMin), height: Math.max(18, top(Math.min(span.endMin, gridEnd)) - top(span.startMin)) }}
                      >
                        🚫 {o.reason ?? "blockiert"}
                      </Link>
                    ))}
                  {appts
                    .filter((a) => a.stylistId === s.id)
                    .map((a) => (
                      <div
                        key={a.id}
                        className={`absolute inset-x-1 overflow-hidden rounded-md border p-1 text-[11px] leading-tight ${statusClass[a.status] ?? ""}`}
                        style={{ top: top(mins(a.startAt)), height: Math.max(20, (mins(a.endAt) - mins(a.startAt)) * PX_PER_MIN - 2) }}
                        title={`${hm(a.startAt)}–${hm(a.endAt)} · ${a.customerName} · ${a.items.map((i) => i.nameSnapshot).join(", ")}`}
                      >
                        <span className="font-semibold">{hm(a.startAt)}</span> {a.customerName}
                        <div className="truncate text-neutral-500">{a.items.map((i) => i.nameSnapshot).join(", ")}</div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }
}
