"use client";

// Month calendar for picking a day. ‹ › switch months (no sideways scrolling).
// The parent controls the visible month (to load availability for it) and
// decides which days are open via `isOpen`.

export function isoWeekday(d: Date) {
  return ((d.getDay() + 6) % 7) + 1; // 1=Mon … 7=Sun
}

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonthPicker({
  month,
  onMonthChange,
  value,
  onPick,
  isOpen,
  minDate,
  maxDate,
  loading = false,
  weekdaysShort,
  locale,
  prevLabel,
  nextLabel,
  theme = "dark",
}: {
  /** "YYYY-MM" currently shown. */
  month: string;
  onMonthChange: (month: string) => void;
  value: string | null;
  onPick: (date: string) => void;
  isOpen: (date: string) => boolean;
  /** "YYYY-MM-DD" bounds (inclusive); months outside can't be navigated to. */
  minDate: string;
  maxDate: string;
  loading?: boolean;
  /** Index 1..7 = Mon..Sun. */
  weekdaysShort: string[];
  locale: string;
  prevLabel: string;
  nextLabel: string;
  theme?: "dark" | "light";
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const cells: (Date | null)[] = [
    ...Array<null>(isoWeekday(first) - 1).fill(null),
    ...Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => new Date(y, m - 1, i + 1)),
  ];
  const canPrev = month > minDate.slice(0, 7);
  const canNext = month < maxDate.slice(0, 7);
  const shift = (delta: number) => onMonthChange(ymd(new Date(y, m - 1 + delta, 1)).slice(0, 7));

  const dark = theme === "dark";
  const box = dark ? "border-white/10 bg-white/5" : "border-neutral-200 bg-white";
  const arrow = `flex h-9 w-9 items-center justify-center rounded-full text-lg disabled:opacity-25 ${dark ? "hover:bg-white/10" : "hover:bg-neutral-100"} disabled:hover:bg-transparent`;
  const openCls = dark
    ? "border border-white/15 hover:border-orange-500 hover:bg-orange-500/10"
    : "border border-neutral-300 hover:border-orange-500 hover:bg-orange-50";
  const closedCls = dark ? "text-neutral-700" : "text-neutral-300";

  return (
    <div className={`rounded-2xl border p-3 ${box}`}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label={prevLabel} className={arrow}>
          ‹
        </button>
        <span className="text-sm font-medium">
          {first.toLocaleDateString(locale, { month: "long", year: "numeric" })}
          {loading && <span className="ml-2 inline-block animate-pulse text-neutral-400">…</span>}
        </span>
        <button type="button" onClick={() => shift(1)} disabled={!canNext} aria-label={nextLabel} className={arrow}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
          <div key={wd} className="py-1">
            {weekdaysShort[wd]}
          </div>
        ))}
      </div>
      <div className={`grid grid-cols-7 gap-1 transition-opacity ${loading ? "opacity-60" : ""}`}>
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />;
          const ds = ymd(d);
          const open = ds >= minDate && ds <= maxDate && isOpen(ds);
          const selected = ds === value;
          return (
            <button
              key={ds}
              type="button"
              disabled={!open}
              onClick={() => onPick(ds)}
              className={`aspect-square rounded-lg text-sm transition ${selected ? "bg-orange-500 font-semibold text-white" : open ? openCls : closedCls}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
