import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { emailTransport, shopAlertRecipients } from "@/lib/email";
import { reminderStatus } from "@/lib/reminders";
import { saveSettings, sendSettingsTestEmail } from "./actions";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
const label = "block text-sm font-medium text-neutral-700";
const hint = "mt-1 text-xs text-neutral-500";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; test?: string; msg?: string }>;
}) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const s = await prisma.setting.findUnique({ where: { id: 1 } });
  const transport = emailTransport();
  const alerts = shopAlertRecipients();
  const reminders = reminderStatus();

  const testMsg: Record<string, { ok: boolean; text: string }> = {
    sent: { ok: true, text: "Test-E-Mail verschickt. Schau in dein Postfach (auch im Spam-Ordner)." },
    nosetup: { ok: false, text: "Noch kein E-Mail-Versand eingerichtet (siehe Hinweis oben)." },
    invalid: { ok: false, text: "Bitte eine gültige E-Mail-Adresse eingeben." },
    failed: { ok: false, text: `Versand fehlgeschlagen: ${sp.msg ?? "unbekannter Fehler"}` },
  };
  const test = sp.test ? testMsg[sp.test] : undefined;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-neutral-500">Kontaktdaten und Buchungsregeln. Änderungen gelten sofort auf der Website.</p>
      </div>

      {sp.saved && <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">Gespeichert.</p>}

      <form action={saveSettings} className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <fieldset className="space-y-4">
          <legend className="font-semibold">Kontakt</legend>
          <div>
            <label htmlFor="shopPhone" className={label}>Telefon</label>
            <input id="shopPhone" name="shopPhone" defaultValue={s?.shopPhone ?? ""} maxLength={40} className={input} />
            <p className={hint}>Steht auf der Website und in allen E-Mails an Kund:innen.</p>
          </div>
          <div>
            <label htmlFor="shopAddress" className={label}>Adresse</label>
            <input id="shopAddress" name="shopAddress" defaultValue={s?.shopAddress ?? ""} maxLength={200} className={input} />
            <p className={hint}>Für Website, Kalendereintrag und E-Mails. Impressum und Datenschutz bitte zusätzlich prüfen lassen.</p>
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-neutral-100 pt-5">
          <legend className="font-semibold">Online-Buchung</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bookingWindowDays" className={label}>Buchbar bis (Tage im Voraus)</label>
              <input id="bookingWindowDays" name="bookingWindowDays" type="number" min={1} max={365} defaultValue={s?.bookingWindowDays ?? 60} className={input} />
            </div>
            <div>
              <label htmlFor="minLeadTimeHours" className={label}>Frühestens (Stunden vorher)</label>
              <input id="minLeadTimeHours" name="minLeadTimeHours" type="number" min={0} max={72} defaultValue={Math.round((s?.minLeadTimeMin ?? 120) / 60)} className={input} />
              <p className={hint}>0 = auch kurzfristig noch am selben Tag.</p>
            </div>
            <div>
              <label htmlFor="cancellationCutoffHours" className={label}>Online absagen bis (Stunden vorher)</label>
              <input id="cancellationCutoffHours" name="cancellationCutoffHours" type="number" min={0} max={72} defaultValue={Math.round((s?.cancellationCutoffMin ?? 120) / 60)} className={input} />
              <p className={hint}>Danach müssen Kund:innen anrufen.</p>
            </div>
            <div>
              <label htmlFor="slotGranularityMin" className={label}>Zeit-Raster</label>
              <select id="slotGranularityMin" name="slotGranularityMin" defaultValue={String(s?.slotGranularityMin ?? 15)} className={input}>
                {[5, 10, 15, 20, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    alle {m} Minuten
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="defaultBufferMin" className={label}>Puffer nach jedem Termin (Min.)</label>
              <input id="defaultBufferMin" name="defaultBufferMin" type="number" min={0} max={60} defaultValue={s?.defaultBufferMin ?? 0} className={input} />
              <p className={hint}>Zeit zum Aufräumen, bevor der nächste Termin starten kann.</p>
            </div>
          </div>
        </fieldset>

        <button className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600">Speichern</button>
      </form>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">E-Mail-Versand</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Versand über</dt>
            <dd className={`mt-0.5 font-medium ${transport === "log" ? "text-red-700" : "text-green-700"}`}>
              {transport === "resend" ? "Resend ✓" : transport === "smtp" ? "SMTP (z. B. Gmail) ✓" : "nicht eingerichtet ✗"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Info über neue Buchungen an</dt>
            <dd className="mt-0.5 font-medium">{alerts.length ? alerts.join(", ") : <span className="text-red-700">niemanden (NOTIFY_EMAIL fehlt)</span>}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-neutral-500">Erinnerung am Vortag</dt>
            <dd className={`mt-0.5 font-medium ${reminders.ok ? "text-green-700" : "text-amber-700"}`}>{reminders.text}</dd>
          </div>
        </dl>
        {transport === "log" && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Wird auf dem Server eingestellt (Netlify → Environment variables): entweder <code>RESEND_API_KEY</code> oder{" "}
            <code>SMTP_URL</code>, dazu <code>EMAIL_FROM</code> und <code>NOTIFY_EMAIL</code>. Bis dahin werden E-Mails nur protokolliert.
          </p>
        )}
        {test && (
          <p className={`rounded-lg p-3 text-sm ${test.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{test.text}</p>
        )}
        <form action={sendSettingsTestEmail} className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label htmlFor="to" className={label}>Test-E-Mail senden an</label>
            <input id="to" name="to" type="email" defaultValue={alerts[0] ?? session.user?.email ?? ""} className={input} />
          </div>
          <button className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100">Test senden</button>
        </form>
      </section>
    </div>
  );
}
