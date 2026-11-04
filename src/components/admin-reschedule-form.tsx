"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getRescheduleSlots,
  rescheduleAppointment,
} from "@/app/admin/(dashboard)/appointments/actions";

type Barber = { id: string; name: string };

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Move an appointment to another time and/or barber, optionally emailing the customer. */
export function AdminRescheduleForm({
  appointmentId,
  currentStylistId,
  currentDate,
  barbers,
  customerEmail,
}: {
  appointmentId: string;
  currentStylistId: string;
  /** "YYYY-MM-DD" in shop time. */
  currentDate: string;
  /** Only barbers who offer all booked services. */
  barbers: Barber[];
  customerEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stylistId, setStylistId] = useState(currentStylistId);
  const [date, setDate] = useState(currentDate < todayStr() ? todayStr() : currentDate);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [notify, setNotify] = useState(Boolean(customerEmail));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function load(sid = stylistId, d = date) {
    setSlot(null);
    setSlots(null);
    setMessage(null);
    startTransition(async () => setSlots(await getRescheduleSlots(appointmentId, sid, d)));
  }

  function save() {
    if (!slot) return;
    startTransition(async () => {
      const res = await rescheduleAppointment({ id: appointmentId, stylistId, startAt: slot, notify });
      if (res.ok) {
        setMessage({
          ok: true,
          text: res.emailed
            ? `Verschoben. ${customerEmail} hat eine E-Mail mit der neuen Zeit bekommen.`
            : "Verschoben.",
        });
        setOpen(false);
        setSlots(null);
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
        load();
      }
    });
  }

  if (!open) {
    return (
      <div>
        <button
          onClick={() => {
            setOpen(true);
            load();
          }}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
        >
          Verschieben
        </button>
        {message && (
          <p className={`mt-2 text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Termin verschieben</h3>
        <button onClick={() => setOpen(false)} className="text-sm text-neutral-500 hover:text-neutral-900">
          Abbrechen
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rs-barber" className="block text-sm font-medium text-neutral-700">Friseur:in</label>
          <select
            id="rs-barber"
            value={stylistId}
            onChange={(e) => {
              setStylistId(e.target.value);
              load(e.target.value, date);
            }}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rs-date" className="block text-sm font-medium text-neutral-700">Datum</label>
          <input
            id="rs-date"
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => {
              setDate(e.target.value);
              if (e.target.value) load(stylistId, e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-neutral-700">Neue Uhrzeit</div>
        {pending && slots === null ? (
          <p className="mt-1 text-sm text-neutral-400">Lade freie Zeiten…</p>
        ) : slots && slots.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-500">An diesem Tag ist nichts frei.</p>
        ) : (
          <div className="mt-1 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {(slots ?? []).map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={`rounded-lg border py-1.5 text-sm ${slot === s ? "border-orange-500 bg-orange-500 text-white" : "border-neutral-300 bg-white hover:border-orange-400"}`}
              >
                {fmtTime(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      {customerEmail ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Kund:in per E-Mail über die neue Zeit informieren
        </label>
      ) : (
        <p className="text-xs text-neutral-500">Keine E-Mail hinterlegt. Bitte telefonisch Bescheid geben.</p>
      )}

      {message && !message.ok && <p className="text-sm text-red-700">{message.text}</p>}

      <button
        onClick={save}
        disabled={!slot || pending}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
      >
        {slot ? `Auf ${fmtDay(slot)}, ${fmtTime(slot)} Uhr verschieben` : "Zeit wählen"}
      </button>
    </div>
  );
}
