import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { PushToggle } from "@/components/push-toggle";
import { getVapidKeys } from "@/lib/push";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500";
const label = "text-sm font-medium text-neutral-700";
const hint = "mt-1 block text-xs font-normal text-neutral-400";
const notice = [
  [0, "keine"],
  [30, "30 Minuten"],
  [60, "1 Stunde"],
  [120, "2 Stunden"],
  [180, "3 Stunden"],
  [360, "6 Stunden"],
  [720, "12 Stunden"],
  [1440, "24 Stunden"],
  [2880, "48 Stunden"],
] as const;

function Select({ name, value, options }: { name: string; value: number; options: readonly (readonly [number, string])[] }) {
  const opts = options.some(([v]) => v === value) ? options : [...options, [value, `${value} Minuten`] as const];
  return (
    <select name={name} defaultValue={value} className={input}>
      {opts.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [s, devices, vapid] = await Promise.all([
    prisma.setting.findUnique({ where: { id: 1 } }),
    prisma.pushSubscription.count(),
    getVapidKeys(),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        {sp.saved && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">Gespeichert.</p>}
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Benachrichtigungen aufs Handy</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Bei jeder neuen Buchung, Absage oder Verschiebung kommt eine Mitteilung auf dieses Gerät.
          {devices > 0 ? ` Aktiv auf ${devices} ${devices === 1 ? "Gerät" : "Geräten"}.` : ""}
        </p>
        <div className="mt-3">
          <PushToggle publicKey={vapid.publicKey} />
        </div>
      </section>

      <form action={saveSettings} className="space-y-8">
        <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Salon</h2>
          <label className={label}>
            Telefon
            <input name="shopPhone" defaultValue={s?.shopPhone ?? ""} maxLength={40} className={input} />
            <span className={hint}>Steht auf der Website und in den E-Mails.</span>
          </label>
          <label className={label}>
            Adresse
            <input name="shopAddress" defaultValue={s?.shopAddress ?? ""} maxLength={120} className={input} />
          </label>
        </section>

        <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Online-Buchung</h2>
          <label className={label}>
            So weit im Voraus buchbar (Tage)
            <input name="bookingWindowDays" type="number" min={7} max={365} defaultValue={s?.bookingWindowDays ?? 60} className={input} />
          </label>
          <label className={label}>
            Mindestens so kurzfristig vorher
            <Select name="minLeadTimeMin" value={s?.minLeadTimeMin ?? 120} options={notice} />
            <span className={hint}>Online gibt es keinen Termin, der früher beginnt.</span>
          </label>
          <label className={label}>
            Absagen und Verschieben online bis
            <Select name="cancellationCutoffMin" value={s?.cancellationCutoffMin ?? 120} options={notice} />
            <span className={hint}>vor dem Termin. Danach nur noch telefonisch.</span>
          </label>
          <label className={label}>
            Terminzeiten im Abstand von
            <Select name="slotGranularityMin" value={s?.slotGranularityMin ?? 15} options={[[10, "10 Minuten"], [15, "15 Minuten"], [20, "20 Minuten"], [30, "30 Minuten"]]} />
          </label>
          <label className={label}>
            Pause zwischen zwei Terminen
            <Select name="defaultBufferMin" value={s?.defaultBufferMin ?? 0} options={[[0, "keine"], [5, "5 Minuten"], [10, "10 Minuten"], [15, "15 Minuten"]]} />
          </label>
        </section>

        <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Google-Bewertung (auf der Startseite)</h2>
          <label className={label}>
            Sterne
            <input name="googleRating" type="number" step="0.1" min={1} max={5} defaultValue={s?.googleRating ?? 4.3} className={input} />
          </label>
          <label className={label}>
            Anzahl Bewertungen
            <input name="googleReviewCount" type="number" min={0} defaultValue={s?.googleReviewCount ?? 0} className={input} />
            <span className={hint}>Ab und zu aus Google Maps übernehmen.</span>
          </label>
        </section>

        <button className="w-full rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600 sm:w-auto">Speichern</button>
      </form>
    </div>
  );
}
