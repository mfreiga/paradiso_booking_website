import { prisma } from "@/lib/prisma";
import { isOwner, requireStaff } from "@/lib/auth-guard";
import { getVapidKeys } from "@/lib/push";
import { PushToggle } from "@/components/push-toggle";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { changeOwnPassword } from "./actions";

export const dynamic = "force-dynamic";

const pwMsg: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "Passwort geändert." },
  wrong: { ok: false, text: "Das aktuelle Passwort stimmt nicht." },
  mismatch: { ok: false, text: "Die beiden neuen Passwörter sind nicht gleich." },
  short: { ok: false, text: `Das neue Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.` },
  env: { ok: false, text: "Der gemeinsame Inhaber-Zugang wird auf Netlify (ADMIN_PASSWORD) geändert." },
};
const input = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
const card = "space-y-3 rounded-2xl border border-neutral-200 bg-white p-5";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const [vapid, stylist, devices] = await Promise.all([
    getVapidKeys(),
    staff.stylistId ? prisma.stylist.findUnique({ where: { id: staff.stylistId }, select: { name: true } }) : null,
    prisma.pushSubscription.count({ where: { userId: staff.isEnvAdmin ? null : staff.id } }),
  ]);
  const msg = sp.status ? pwMsg[sp.status] : undefined;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mein Konto</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {staff.name} · {isOwner(staff) ? "Inhaber (alles sichtbar)" : `Friseur:in${stylist ? ` – Kalender von ${stylist.name}` : ""}`}
        </p>
      </div>

      <section className={card}>
        <h2 className="font-semibold">📱 Als App aufs Handy</h2>
        <p className="text-sm text-neutral-600">
          Einmal einrichten, dann öffnest du den Kalender wie eine App und bekommst eine Mitteilung bei jeder neuen Buchung
          {isOwner(staff) ? "" : " bei dir"}, Absage oder Verschiebung.
        </p>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-neutral-50 p-3">
            <p className="font-medium">iPhone</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-neutral-600">
              <li>Diese Seite in <strong>Safari</strong> öffnen</li>
              <li>Teilen-Symbol <span aria-hidden>⬆︎</span> antippen</li>
              <li>„<strong>Zum Home-Bildschirm</strong>“ → Hinzufügen</li>
              <li>Die neue App „Paradiso“ öffnen, einloggen</li>
              <li>Hier unten „Benachrichtigungen einschalten“</li>
            </ol>
          </div>
          <div className="rounded-xl bg-neutral-50 p-3">
            <p className="font-medium">Android</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-neutral-600">
              <li>Diese Seite in <strong>Chrome</strong> öffnen</li>
              <li>Menü ⋮ antippen</li>
              <li>„<strong>App installieren</strong>“ bzw. „Zum Startbildschirm“</li>
              <li>Hier unten „Benachrichtigungen einschalten“</li>
            </ol>
          </div>
        </div>
        <div className="border-t border-neutral-100 pt-3">
          <PushToggle publicKey={vapid.publicKey} />
          {devices > 0 && <p className="mt-2 text-xs text-neutral-500">Aktiv auf {devices} {devices === 1 ? "Gerät" : "Geräten"}.</p>}
        </div>
      </section>

      {!staff.isEnvAdmin && (
        <section className={card}>
          <h2 className="font-semibold">Passwort ändern</h2>
          {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}
          <form action={changeOwnPassword} className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-neutral-700">
              Aktuelles Passwort
              <input name="current" type="password" required autoComplete="current-password" className={input} />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              Neues Passwort
              <input name="next" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className={input} />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              Nochmal
              <input name="repeat" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className={input} />
            </label>
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 sm:col-span-3 sm:justify-self-start">
              Passwort speichern
            </button>
          </form>
        </section>
      )}
      {staff.isEnvAdmin && msg && <p className="rounded-lg bg-neutral-100 p-3 text-sm text-neutral-700">{msg.text}</p>}
    </div>
  );
}
