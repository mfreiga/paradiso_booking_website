"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminSlots,
  createAdminBooking,
} from "@/app/admin/(dashboard)/appointments/new/actions";

type VariantOpt = { id: string; label: string; priceCents: number; durationMinutes: number };
type Barber = { id: string; name: string; variants: VariantOpt[] };

const euro = (c: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AdminNewBookingForm({ barbers }: { barbers: Barber[] }) {
  const router = useRouter();
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const variantIds = [...selected];
  const chosen = (barber?.variants ?? []).filter((v) => selected.has(v.id));
  const totalDuration = chosen.reduce((s, v) => s + v.durationMinutes, 0);
  const totalPrice = chosen.reduce((s, v) => s + v.priceCents, 0);

  function resetSlots() {
    setSlots([]);
    setSlot(null);
    setLoaded(false);
  }
  function changeBarber(id: string) {
    setBarberId(id);
    setSelected(new Set());
    resetSlots();
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    resetSlots();
  }
  function loadSlots() {
    if (!barberId || variantIds.length === 0 || !date) return;
    startTransition(async () => {
      const s = await getAdminSlots(barberId, date, variantIds);
      setSlots(s);
      setSlot(null);
      setLoaded(true);
    });
  }
  function submit() {
    setError(null);
    if (!slot) return setError("Bitte eine Zeit wählen.");
    if (!name.trim()) return setError("Bitte einen Namen angeben.");
    startTransition(async () => {
      const res = await createAdminBooking({
        stylistId: barberId,
        variantIds,
        startAt: slot,
        customerName: name,
        customerPhone: phone,
      });
      if (res.ok) router.push("/admin/appointments");
      else setError(res.error);
    });
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <label className="block text-sm font-medium text-neutral-700">Friseur:in</label>
        <select
          value={barberId}
          onChange={(e) => changeBarber(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">Leistung(en)</label>
        <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-200">
          {(barber?.variants ?? []).map((v) => (
            <label
              key={v.id}
              className={`flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-0 ${selected.has(v.id) ? "bg-orange-50" : ""}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(v.id)}
                  onChange={() => toggle(v.id)}
                />
                {v.label}
              </span>
              <span className="shrink-0 text-neutral-500">
                {euro(v.priceCents)} · {v.durationMinutes} Min
              </span>
            </label>
          ))}
        </div>
        {selected.size > 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            Gesamt: {euro(totalPrice)} · {totalDuration} Min
          </p>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-neutral-700">Datum</label>
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => {
              setDate(e.target.value);
              resetSlots();
            }}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={loadSlots}
          disabled={pending || selected.size === 0}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-40"
        >
          Zeiten anzeigen
        </button>
      </div>

      {loaded &&
        (slots.length === 0 ? (
          <p className="text-sm text-neutral-500">Keine freien Zeiten an diesem Tag.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                className={`rounded-lg border py-2 text-sm ${slot === s ? "border-orange-500 bg-orange-50 text-orange-700" : "border-neutral-300 hover:border-orange-400"}`}
              >
                {fmtTime(s)}
              </button>
            ))}
          </div>
        ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Telefon (optional)
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <button
        onClick={submit}
        disabled={pending || !slot || !name.trim()}
        className="rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? "Speichern…" : "Termin eintragen"}
      </button>
    </div>
  );
}
