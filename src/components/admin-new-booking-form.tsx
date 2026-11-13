"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ANY_BARBER } from "@/lib/admin-booking";
import {
  createAdminBooking,
  findCustomers,
  getAdminSlots,
  type AdminSlot,
  type KnownCustomer,
} from "@/app/admin/(dashboard)/appointments/new/actions";

type VariantOpt = { id: string; label: string; priceCents: number; durationMinutes: number };
type Barber = { id: string; name: string; variants: VariantOpt[] };

const euro = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: "Europe/Berlin" }).format(new Date(iso));
function dayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const input = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
const label = "block text-sm font-medium text-neutral-700";

/**
 * Phone / walk-in booking, ordered like the call: who → what → with whom → when.
 * Returning customers are found by phone number or name and filled in.
 */
export function AdminNewBookingForm({
  barbers,
  canPickAny,
  initialBarber,
  initialDate,
}: {
  barbers: Barber[];
  canPickAny: boolean;
  initialBarber?: string;
  initialDate?: string;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<KnownCustomer | null>(null);

  const [barberId, setBarberId] = useState(initialBarber ?? (canPickAny ? ANY_BARBER : barbers[0]?.id ?? ""));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [date, setDate] = useState(initialDate ?? dayStr());
  // Free times tagged with the inputs they were loaded for, so stale ones are never shown.
  const [loaded, setLoaded] = useState<{ key: string; list: AdminSlot[] } | null>(null);
  const [picks, setPicks] = useState<{ key: string; slot: AdminSlot } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; stylistName: string; startAt: string; emailed: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingSlots, startSlots] = useTransition();

  // "Egal wer": offer services any barber has; the chosen time decides who.
  const anyMode = barberId === ANY_BARBER;
  const options: VariantOpt[] = anyMode
    ? [...new Map(barbers.flatMap((b) => b.variants).map((v) => [v.id, v])).values()]
    : (barbers.find((b) => b.id === barberId)?.variants ?? []);
  const chosen = options.filter((v) => selected.has(v.id));
  const totalDuration = chosen.reduce((s, v) => s + v.durationMinutes, 0);
  const totalPrice = chosen.reduce((s, v) => s + v.priceCents, 0);
  const shown = filter ? options.filter((v) => v.label.toLowerCase().includes(filter.toLowerCase())) : options;
  const variantKey = [...selected].sort().join(",");
  const slotKey = `${barberId}|${variantKey}|${date}`;
  const slots = variantKey && loaded?.key === slotKey ? loaded.list : null;
  const slot = picks?.key === slotKey ? picks.slot : null;
  const setSlot = (s: AdminSlot) => setPicks({ key: slotKey, slot: s });
  const q = (phone.replace(/\D/g, "").length >= 3 ? phone : name).trim();
  const [found, setFound] = useState<{ q: string; list: KnownCustomer[] } | null>(null);
  const matches = !picked && q.length >= 3 && found?.q === q ? found.list : [];

  // Look up returning customers while typing phone or name (debounced).
  useEffect(() => {
    if (picked || q.length < 3) return;
    const t = setTimeout(() => findCustomers(q).then((list) => setFound({ q, list })), 300);
    return () => clearTimeout(t);
  }, [q, picked]);

  // Free times reload by themselves when barber, services or day change.
  useEffect(() => {
    if (!barberId || !variantKey || !date) return;
    const key = `${barberId}|${variantKey}|${date}`;
    startSlots(async () => {
      const list = await getAdminSlots(barberId, date, variantKey.split(","));
      setLoaded({ key, list });
    });
  }, [barberId, variantKey, date]);

  function pick(c: KnownCustomer) {
    setPicked(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email);
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function reset() {
    setPhone("");
    setName("");
    setEmail("");
    setNote("");
    setPicked(null);
    setSelected(new Set());
    setFilter("");
    setPicks(null);
    setDone(null);
    setError(null);
  }
  function submit() {
    setError(null);
    if (!slot) return setError("Bitte eine Uhrzeit wählen.");
    if (!name.trim()) return setError("Bitte einen Namen angeben.");
    startTransition(async () => {
      const res = await createAdminBooking({
        stylistId: slot.stylistId,
        variantIds: [...selected],
        startAt: slot.iso,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        note,
      });
      if (res.ok) setDone(res);
      else {
        setError(res.error);
        startSlots(async () => setLoaded({ key: slotKey, list: await getAdminSlots(barberId, date, [...selected]) }));
      }
    });
  }

  if (done) {
    return (
      <div className="max-w-xl rounded-2xl border border-green-200 bg-green-50 p-5">
        <p className="text-lg font-semibold text-green-900">✓ Eingetragen</p>
        <p className="mt-1 text-sm text-green-900">
          {name} · {fmtDay(done.startAt)}, {fmtTime(done.startAt)} Uhr bei {done.stylistName}
        </p>
        <p className="mt-1 text-xs text-green-800">
          {done.emailed
            ? `Bestätigung an ${email} geschickt.`
            : email
              ? "E-Mail-Versand ist noch nicht eingerichtet – bitte die Uhrzeit am Telefon nochmal bestätigen."
              : "Keine E-Mail angegeben – bitte die Uhrzeit am Telefon nochmal bestätigen."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={reset} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
            Nächsten Termin eintragen
          </button>
          <Link href={`/admin/calendar?view=day&date=${date}`} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100">
            Im Kalender ansehen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* 1 — Who */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">1 · Kund:in</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nb-phone" className={label}>Telefon</label>
            <input id="nb-phone" type="tel" inputMode="tel" autoComplete="off" value={phone}
              onChange={(e) => { setPhone(e.target.value); setPicked(null); }} className={input} placeholder="z. B. 0170 1234567" />
          </div>
          <div>
            <label htmlFor="nb-name" className={label}>Name</label>
            <input id="nb-name" autoComplete="off" value={name}
              onChange={(e) => { setName(e.target.value); setPicked(null); }} className={input} />
          </div>
        </div>
        {matches.length > 0 && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-2">
            <p className="px-1 pb-1 text-xs font-medium text-orange-900">Schon mal da gewesen?</p>
            {matches.map((c) => (
              <button key={`${c.phone}${c.email}${c.name}`} type="button" onClick={() => pick(c)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white">
                <span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-neutral-500"> · {c.phone || c.email}</span>
                </span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {c.visits} Besuche{c.lastBarber ? ` · zuletzt ${c.lastBarber}` : ""}
                  {c.noShows > 0 && <span className="text-red-600"> · {c.noShows}× nicht erschienen</span>}
                </span>
              </button>
            ))}
          </div>
        )}
        {picked && (
          <p className="text-xs text-green-700">
            ✓ Stammkund:in übernommen ({picked.visits} Besuche){picked.noShows > 0 && <span className="text-red-600"> · Achtung: {picked.noShows}× nicht erschienen</span>}
          </p>
        )}
        <div>
          <label htmlFor="nb-email" className={label}>E-Mail <span className="font-normal text-neutral-400">(optional)</span></label>
          <input id="nb-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <p className="mt-1 text-xs text-neutral-400">Mit E-Mail bekommt die Person Bestätigung, Erinnerung und Absage-Link.</p>
        </div>
      </section>

      {/* 2 — What + with whom */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">2 · Leistung</h2>
        {(barbers.length > 1 || canPickAny) && (
          <div>
            <label htmlFor="nb-barber" className={label}>Bei wem?</label>
            <select id="nb-barber" value={barberId}
              onChange={(e) => { setBarberId(e.target.value); setSelected(new Set()); }} className={input}>
              {canPickAny && <option value={ANY_BARBER}>Egal wer – erste freie Zeit</option>}
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Leistung suchen, z. B. „Bart“" aria-label="Leistung suchen" className={input} />
        <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white">
          {shown.map((v) => (
            <label key={v.id} className={`flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-0 ${selected.has(v.id) ? "bg-orange-50" : ""}`}>
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
                {v.label}
              </span>
              <span className="shrink-0 text-neutral-500">{euro(v.priceCents)} · {v.durationMinutes} Min</span>
            </label>
          ))}
          {shown.length === 0 && <p className="px-3 py-2 text-sm text-neutral-400">Nichts gefunden.</p>}
        </div>
        {selected.size > 0 && <p className="text-xs text-neutral-500">Gesamt: {euro(totalPrice)} · {totalDuration} Min</p>}
      </section>

      {/* 3 — When */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">3 · Wann?</h2>
        <div className="flex flex-wrap items-center gap-2">
          {[["Heute", dayStr()], ["Morgen", dayStr(1)]].map(([l, d]) => (
            <button key={l} type="button" onClick={() => setDate(d)}
              className={`rounded-full border px-3 py-1.5 text-sm ${date === d ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white hover:bg-neutral-100"}`}>
              {l}
            </button>
          ))}
          <input type="date" value={date} min={dayStr()} onChange={(e) => setDate(e.target.value)} aria-label="Datum" className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm" />
        </div>
        {selected.size === 0 ? (
          <p className="text-sm text-neutral-400">Erst eine Leistung wählen, dann erscheinen die freien Zeiten.</p>
        ) : loadingSlots || slots === null ? (
          <p className="text-sm text-neutral-400">Lade freie Zeiten…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-neutral-500">An diesem Tag ist nichts mehr frei. Anderen Tag wählen.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => (
              <button key={s.iso} type="button" onClick={() => setSlot(s)}
                className={`rounded-lg border py-2 text-sm ${slot?.iso === s.iso ? "border-orange-500 bg-orange-500 text-white" : "border-neutral-300 bg-white hover:border-orange-400"}`}>
                {fmtTime(s.iso)}
              </button>
            ))}
          </div>
        )}
        {slot && anyMode && (
          <p className="text-xs text-neutral-600">→ bei {barbers.find((b) => b.id === slot.stylistId)?.name}</p>
        )}
      </section>

      <div>
        <label htmlFor="nb-note" className={label}>Notiz <span className="font-normal text-neutral-400">(optional, z. B. „nur Spitzen“)</span></label>
        <textarea id="nb-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={input} />
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <button onClick={submit} disabled={pending || !slot || !name.trim()}
        className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40 sm:w-auto">
        {pending ? "Speichern…" : slot ? `Eintragen: ${fmtTime(slot.iso)} Uhr` : "Termin eintragen"}
      </button>
    </div>
  );
}
