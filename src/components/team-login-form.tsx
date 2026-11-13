"use client";

import { useState, useTransition } from "react";
import { createLogin, resetLoginPassword, type NewLogin } from "@/app/admin/(dashboard)/team/actions";

const input = "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";

/** Shows a freshly generated password once, with a copy button. */
function OneTimePassword({ result }: { result: Extract<NewLogin, { ok: true }> }) {
  const [copied, setCopied] = useState(false);
  const text = `Benutzername: ${result.username}\nPasswort: ${result.password}`;
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
      <p className="font-medium text-green-900">Zugang bereit – das Passwort wird nur jetzt angezeigt:</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 font-mono text-base">
        <dt className="text-green-800">Benutzer</dt>
        <dd>{result.username}</dd>
        <dt className="text-green-800">Passwort</dt>
        <dd className="select-all">{result.password}</dd>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
          className="rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-900 hover:bg-green-100"
        >
          {copied ? "✓ Kopiert" : "Kopieren"}
        </button>
        <span className="text-xs text-green-800">
          Persönlich weitergeben. Login unter <strong>/admin</strong>, danach unter „Mein Konto“ eigenes Passwort setzen.
        </span>
      </div>
    </div>
  );
}

export function TeamLoginForm({ stylists }: { stylists: { id: string; name: string }[] }) {
  const [stylistId, setStylistId] = useState(stylists[0]?.id ?? "");
  const [username, setUsername] = useState((stylists[0]?.name ?? "").toLowerCase());
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"BARBER" | "OWNER">("BARBER");
  const [result, setResult] = useState<NewLogin | null>(null);
  const [pending, startTransition] = useTransition();

  function pickStylist(id: string) {
    setStylistId(id);
    const name = stylists.find((s) => s.id === id)?.name ?? "";
    setUsername(name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, ""));
  }
  function submit() {
    startTransition(async () => setResult(await createLogin({ stylistId, username, email, role })));
  }

  if (result?.ok) {
    return (
      <div className="space-y-3">
        <OneTimePassword result={result} />
        <button onClick={() => setResult(null)} className="text-sm text-neutral-600 underline">
          Weiteren Zugang anlegen
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-neutral-700">
        Kalender von
        <select value={stylistId} onChange={(e) => pickStylist(e.target.value)} className={input}>
          {stylists.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="">– keinem (nur Inhaber-Zugang) –</option>
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Rolle
        <select value={role} onChange={(e) => setRole(e.target.value === "OWNER" ? "OWNER" : "BARBER")} className={input}>
          <option value="BARBER">Friseur:in – sieht nur eigene Termine</option>
          <option value="OWNER">Inhaber – sieht und verwaltet alles</option>
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Benutzername
        <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={30} autoComplete="off" className={input} />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        E-Mail <span className="font-normal text-neutral-400">(optional, Login auch damit)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className={input} />
      </label>
      {result && !result.ok && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{result.error}</p>}
      <button
        onClick={submit}
        disabled={pending || !username}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40 sm:col-span-2 sm:justify-self-start"
      >
        {pending ? "Wird angelegt…" : "Zugang anlegen"}
      </button>
    </div>
  );
}

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [result, setResult] = useState<NewLogin | null>(null);
  const [pending, startTransition] = useTransition();
  if (result?.ok) return <OneTimePassword result={result} />;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Neues Passwort erzeugen? Das alte gilt dann nicht mehr.")) {
          startTransition(async () => setResult(await resetLoginPassword(userId)));
        }
      }}
      className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
    >
      {pending ? "…" : "Neues Passwort"}
    </button>
  );
}
