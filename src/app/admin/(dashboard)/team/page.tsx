import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { ResetPasswordButton, TeamLoginForm } from "@/components/team-login-form";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteLogin, setLoginActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireAdmin();
  const [users, stylists] = await Promise.all([
    prisma.user.findMany({
      where: { username: { not: null } },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      include: { stylist: { select: { name: true } }, _count: { select: { pushSubscriptions: true } } },
    }),
    prisma.stylist.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const withLogin = new Set(users.map((u) => u.stylistId).filter(Boolean));
  const free = stylists.filter((s) => !withLogin.has(s.id));
  const btn = "rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team-Zugänge</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Jede:r Friseur:in bekommt einen eigenen Login und sieht nur die eigenen Termine: Kalender, Termine eintragen, eigene
          Zeit blockieren, Benachrichtigungen aufs Handy. Leistungen, Preise, andere Friseure und Einstellungen sieht nur der Inhaber.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <ul className="divide-y divide-neutral-100">
          {users.length === 0 && <li className="px-4 py-3 text-sm text-neutral-400">Noch keine persönlichen Zugänge.</li>}
          {users.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${u.isActive ? "" : "opacity-50"}`}>
              <div className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.name ?? u.username}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.role === "BARBER" ? "bg-neutral-100 text-neutral-600" : "bg-orange-100 text-orange-800"}`}>
                    {u.role === "BARBER" ? "Friseur:in" : "Inhaber"}
                  </span>
                  {!u.isActive && <span className="text-xs text-red-700">gesperrt</span>}
                </div>
                <div className="text-neutral-500">
                  Login: <span className="font-mono">{u.username}</span>
                  {u.email && ` · ${u.email}`}
                  {u.stylist && ` · Kalender ${u.stylist.name}`}
                </div>
                <div className="text-xs text-neutral-400">
                  {u.lastLoginAt ? `zuletzt angemeldet ${DateTime.fromJSDate(u.lastLoginAt).setZone("Europe/Berlin").toFormat("dd.MM.yyyy, HH:mm")}` : "noch nie angemeldet"}
                  {u._count.pushSubscriptions > 0 && ` · 🔔 ${u._count.pushSubscriptions} Gerät(e)`}
                </div>
              </div>
              {u.id !== me.id && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <ResetPasswordButton userId={u.id} />
                  <form action={setLoginActive}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="active" value={String(!u.isActive)} />
                    <button className={btn}>{u.isActive ? "Sperren" : "Entsperren"}</button>
                  </form>
                  <form action={deleteLogin}>
                    <input type="hidden" name="id" value={u.id} />
                    <ConfirmButton message={`Zugang von ${u.name ?? u.username} endgültig löschen?`} className={`${btn} text-red-700`}>
                      Löschen
                    </ConfirmButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Neuen Zugang anlegen</h2>
        {free.length === 0 && users.length > 0 && (
          <p className="text-sm text-neutral-500">Alle Friseur:innen haben schon einen Zugang. Weitere Inhaber-Zugänge gehen ohne Kalender.</p>
        )}
        <TeamLoginForm stylists={free} />
      </section>

      <p className="text-xs text-neutral-500">
        Der gemeinsame Inhaber-Login (ADMIN_EMAILS / ADMIN_PASSWORD auf Netlify) funktioniert weiterhin als Generalschlüssel.
      </p>
    </div>
  );
}
