import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import Link from "next/link";
import { emailTransport, shopAlertRecipients } from "@/lib/email";
import { saveSettings, sendSettingsTestEmail } from "./actions";

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

const testMsg: Record<string, { ok: boolean; text: string }> = {
  sent: { ok: true, text: "Test-E-Mail verschickt. Schau ins Postfach (auch in den Spam-Ordner)." },
  nosetup: { ok: false, text: "Noch kein E-Mail-Versand eingerichtet (siehe oben)." },
  invalid: { ok: false, text: "Bitte eine gültige E-Mail-Adresse eingeben." },
  failed: { ok: false, text: "Versand fehlgeschlagen – Zugangsdaten auf Netlify prüfen (Fehler steht im Netlify-Log)." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; test?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [s, devices] = await Promise.all([
    prisma.setting.findUnique({ where: { id: 1 } }),
    prisma.pushSubscription.count(),
  ]);
  const transport = emailTransport();
  const alerts = shopAlertRecipients();
  const test = sp.test ? testMsg[sp.test] : undefined;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        {sp.saved && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">Gespeichert.</p>}
      </div>

      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">E-Mail-Versand</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Versand über</dt>
            <dd className={`mt-0.5 font-medium ${transport === "log" ? "text-red-700" : "text-green-700"}`}>
              {transport === "resend" ? "Resend ✓" : transport === "smtp" ? "Gmail / SMTP ✓" : "nicht eingerichtet ✗"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Info über neue Buchungen an</dt>
            <dd className="mt-0.5 font-medium">{alerts.length ? alerts.join(", ") : <span className="text-red-700">niemanden (NOTIFY_EMAIL fehlt)</span>}</dd>
          </div>
        </dl>
        {transport === "log" && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Wird auf Netlify eingestellt (Site configuration → Environment variables): <code>SMTP_URL</code> oder <code>RESEND_API_KEY</code>, dazu{" "}
            <code>EMAIL_FROM</code> und <code>NOTIFY_EMAIL</code>. Anleitung: <code>LAUNCH.md</code> im Projekt.
          </p>
        )}
        {test && <p className={`rounded-lg p-3 text-sm ${test.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{test.text}</p>}
        <form action={sendSettingsTestEmail} className="flex flex-wrap items-end gap-2">
          <label className={`${label} min-w-56 flex-1`}>
            Test-E-Mail senden an
            <input name="to" type="email" defaultValue={alerts[0] ?? ""} className={input} />
          </label>
          <button className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100">Test senden</button>
        </form>
        <p className="text-xs text-neutral-500">
          Handy-Benachrichtigungen schaltet jede:r unter{" "}
          <Link href="/admin/account" className="underline">Mein Konto</Link> selbst ein
          {devices > 0 ? ` (aktiv auf ${devices} ${devices === 1 ? "Gerät" : "Geräten"})` : ""}.
        </p>
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
