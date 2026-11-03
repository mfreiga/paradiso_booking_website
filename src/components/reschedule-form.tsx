"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonthPicker } from "./month-picker";

type Result = { ok: true } | { ok: false; error: string };

export interface RescheduleLabels {
  barber?: string;
  date: string;
  noSlots: string;
  loading: string;
  confirm: string;
  moving: string;
  failed: string;
  prevMonth: string;
  nextMonth: string;
  morning: string;
  afternoon: string;
  evening: string;
}

const hourInBerlin = (iso: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Berlin" }).format(new Date(iso)));

/** Pick a new day + time for an existing booking. Data comes from bound server actions. */
export function RescheduleForm({
  barbers,
  initialBarberId,
  loadDays,
  loadSlots,
  submit,
  minDate,
  maxDate,
  weekdaysShort,
  locale,
  labels,
  doneHref,
  theme = "dark",
}: {
  /** If more than one, the salon may pick another barber. */
  barbers: { id: string; name: string }[];
  initialBarberId: string;
  loadDays: (stylistId: string, month: string) => Promise<string[]>;
  loadSlots: (stylistId: string, date: string) => Promise<string[]>;
  submit: (stylistId: string, iso: string) => Promise<Result>;
  minDate: string;
  maxDate: string;
  weekdaysShort: string[];
  locale: string;
  labels: RescheduleLabels;
  doneHref: string;
  theme?: "dark" | "light";
}) {
  const router = useRouter();
  const [barberId, setBarberId] = useState(initialBarberId);
  const [month, setMonth] = useState(minDate.slice(0, 7));
  const [openDays, setOpenDays] = useState<Set<string> | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    loadDays(barberId, month).then((days) => {
      if (cancelled) return;
      setOpenDays(new Set(days));
      setLoadingDays(false);
    });
    return () => {
      cancelled = true;
    };
  }, [barberId, month, loadDays]);

  function changeMonth(m: string) {
    setLoadingDays(true);
    setMonth(m);
  }

  function changeBarber(id: string) {
    setBarberId(id);
    setLoadingDays(true);
    setDate(null);
    setSlots([]);
    setSlot(null);
  }

  function pickDay(d: string) {
    setDate(d);
    setSlot(null);
    setLoadingSlots(true);
    startTransition(async () => {
      setSlots(await loadSlots(barberId, d));
      setLoadingSlots(false);
    });
  }

  function confirm() {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const res = await submit(barberId, slot);
      if (res.ok) {
        router.push(doneHref);
        router.refresh();
      } else {
        setError(labels.failed);
        if (date) pickDay(date);
      }
    });
  }

  const dark = theme === "dark";
  const slotCls = (active: boolean) =>
    `rounded-lg border py-2 text-sm ${active ? "border-orange-500 bg-orange-500 text-white" : dark ? "border-white/15 hover:border-orange-500" : "border-neutral-300 hover:border-orange-500"}`;
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
  const groups = [
    { label: labels.morning, slots: slots.filter((s) => hourInBerlin(s) < 12) },
    { label: labels.afternoon, slots: slots.filter((s) => hourInBerlin(s) >= 12 && hourInBerlin(s) < 17) },
    { label: labels.evening, slots: slots.filter((s) => hourInBerlin(s) >= 17) },
  ].filter((g) => g.slots.length > 0);

  return (
    <div className="space-y-4">
      {barbers.length > 1 && labels.barber && (
        <label className="block text-sm font-medium">
          {labels.barber}
          <select
            value={barberId}
            onChange={(e) => changeBarber(e.target.value)}
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${dark ? "border-neutral-700 bg-neutral-900" : "border-neutral-300 bg-white"}`}
          >
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <MonthPicker
        month={month}
        onMonthChange={changeMonth}
        value={date}
        onPick={pickDay}
        isOpen={(d) => !!openDays?.has(d)}
        minDate={minDate}
        maxDate={maxDate}
        loading={loadingDays}
        weekdaysShort={weekdaysShort}
        locale={locale}
        prevLabel={labels.prevMonth}
        nextLabel={labels.nextMonth}
        theme={theme}
      />
      {date && (
        <p className="text-sm font-medium">
          {new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
        </p>
      )}
      {loadingSlots ? (
        <p className="text-sm text-neutral-500">{labels.loading}</p>
      ) : date && slots.length === 0 ? (
        <p className="text-sm text-neutral-500">{labels.noSlots}</p>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">{g.label}</div>
            <div className="grid grid-cols-4 gap-2">
              {g.slots.map((s) => (
                <button key={s} type="button" onClick={() => setSlot(s)} className={slotCls(slot === s)}>
                  {fmt(s)}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      {error && <p className={`rounded-lg p-3 text-sm ${dark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-700"}`}>{error}</p>}
      <button
        type="button"
        onClick={confirm}
        disabled={!slot || pending}
        className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending && slot ? labels.moving : labels.confirm}
        {slot && !pending ? ` (${new Date(slot).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })}, ${fmt(slot)})` : ""}
      </button>
    </div>
  );
}
