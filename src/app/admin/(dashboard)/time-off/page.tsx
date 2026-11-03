import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { createTimeOff, deleteTimeOff } from "./actions";

export const dynamic = "force-dynamic";

const TZ = "Europe/Berlin";
const errorText: Record<string, string> = {
  date: "Bitte ein gültiges Datum wählen.",
  time: "Bitte eine gültige Uhrzeit wählen.",
  range: "Das Ende muss nach dem Beginn liegen (höchstens ein Jahr).",
  barber: "Bitte eine:n Friseur:in wählen.",
};

/** "Mi 24.12. ganztägig", "Mo 22.12. – Mi 24.12. ganztägig", "Di 03.11. 15:00 – 15:30" … */
function formatRange(startAt: Date, endAt: Date): string {
  const s = DateTime.fromJSDate(startAt).setZone(TZ).setLocale("de");
  const e = DateTime.fromJSDate(endAt).setZone(TZ).setLocale("de");
  const day = (d: DateTime) => d.toFormat("ccc dd.MM.");
  const wholeDays = s.toFormat("HH:mm") === "00:00" && e.toFormat("HH:mm") === "00:00";
  if (wholeDays) {
    const last = e.minus({ days: 1 });
    return s.hasSame(last, "day")
      ? `${day(s)} ganztägig`
      : `${day(s)} – ${day(last)} ganztägig`;
  }
  return s.hasSame(e, "day")
    ? `${day(s)} ${s.toFormat("HH:mm")} – ${e.toFormat("HH:mm")}`
    : `${day(s)} ${s.toFormat("HH:mm")} – ${day(e)} ${e.toFormat("HH:mm")}`;
}

export default async function TimeOffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();

  const [stylists, entries] = await Promise.all([
    prisma.stylist.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.timeOff.findMany({
      where: { endAt: { gt: now } },
      orderBy: { startAt: "asc" },
      include: { stylist: { select: { name: true } } },
    }),
  ]);

  // "All barbers" creates one row per barber — show those as a single entry.
  const groups = new Map<string, { ids: string[]; stylistIds: string[]; names: string[]; startAt: Date; endAt: Date; reason: string | null }>();
  for (const e of entries) {
    const key = `${e.startAt.toISOString()}|${e.endAt.toISOString()}|${e.reason ?? ""}`;
    const g = groups.get(key) ?? { ids: [], stylistIds: [], names: [], startAt: e.startAt, endAt: e.endAt, reason: e.reason };
    g.ids.push(e.id);
    g.stylistIds.push(e.stylistId);
    g.names.push(e.stylist.name);
    groups.set(key, g);
  }
  const list = await Promise.all(
    [...groups.values()].map(async (g) => ({
      ...g,
      conflicts: await prisma.appointment.count({
        where: {
          stylistId: { in: g.stylistIds },
          status: { in: ["PENDING", "CONFIRMED"] },
          startAt: { lt: g.endAt },
          endAt: { gt: g.startAt },
        },
      }),
    })),
  );

  const today = DateTime.now().setZone(TZ).toISODate() ?? "";
  const input =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500";

  return (
    <div>
      <h1 className="text-2xl font-semibold">Abwesenheiten</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Urlaub, Krankheit, Pausen oder geschlossene Tage. Gesperrte Zeiten werden
        online nicht mehr angeboten. Telefonische Buchungen trägst du am besten
        als{" "}
        <Link href="/admin/appointments/new" className="underline hover:text-neutral-900">
          neuen Termin
        </Link>{" "}
        ein.
      </p>

      {sp.error && errorText[sp.error] && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorText[sp.error]}</p>
      )}
      {sp.saved && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">Gespeichert.</p>
      )}

      <form action={createTimeOff} className="mt-6 grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-neutral-700 sm:col-span-2">
          Wer?
          <select name="stylistId" required defaultValue="" className={input}>
            <option value="" disabled>
              Bitte wählen…
            </option>
            <option value="ALL">Alle Friseur:innen (Salon geschlossen)</option>
            {stylists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-neutral-700">
          Von (Datum)
          <input type="date" name="fromDate" required min={today} defaultValue={today} className={input} />
        </label>
        <label className="text-sm font-medium text-neutral-700">
          Bis (Datum)
          <input type="date" name="toDate" min={today} className={input} />
          <span className="mt-1 block text-xs font-normal text-neutral-400">Leer = gleicher Tag</span>
        </label>
        <label className="text-sm font-medium text-neutral-700">
          Ab Uhrzeit
          <input type="time" name="fromTime" step={900} className={input} />
        </label>
        <label className="text-sm font-medium text-neutral-700">
          Bis Uhrzeit
          <input type="time" name="toTime" step={900} className={input} />
          <span className="mt-1 block text-xs font-normal text-neutral-400">Ohne Uhrzeiten = ganztägig</span>
        </label>
        <label className="text-sm font-medium text-neutral-700 sm:col-span-2">
          Grund (optional, nur intern)
          <input type="text" name="reason" maxLength={100} placeholder="z. B. Urlaub, Arzttermin" className={input} />
        </label>
        <div className="sm:col-span-2">
          <button className="w-full rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600 sm:w-auto">
            Zeit sperren
          </button>
        </div>
      </form>

      <h2 className="mt-8 text-lg font-semibold">Geplant</h2>
      <div className="mt-3 space-y-3">
        {list.length === 0 && <p className="text-sm text-neutral-400">Keine Abwesenheiten geplant.</p>}
        {list.map((g) => (
          <div key={g.ids.join(",")} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{formatRange(g.startAt, g.endAt)}</div>
                <div className="text-sm text-neutral-500">
                  {g.names.length === stylists.length && stylists.length > 1
                    ? "Alle Friseur:innen"
                    : g.names.join(", ")}
                  {g.reason ? ` · ${g.reason}` : ""}
                </div>
              </div>
              <form action={deleteTimeOff}>
                <input type="hidden" name="ids" value={g.ids.join(",")} />
                <button className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50">
                  Aufheben
                </button>
              </form>
            </div>
            {g.conflicts > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                ⚠ {g.conflicts === 1 ? "1 bestehender Termin liegt" : `${g.conflicts} bestehende Termine liegen`} in
                diesem Zeitraum. Bitte die Kund:innen informieren und unter{" "}
                <Link href="/admin/appointments" className="underline">
                  Termine
                </Link>{" "}
                absagen.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
