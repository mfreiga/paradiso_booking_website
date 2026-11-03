"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/admin/(dashboard)/settings/push-actions";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

function keyToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function detect(): Promise<State> | State {
  if (typeof window === "undefined") return "loading";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
  // On iPhone, web push only works for an app added to the Home Screen.
  if (ios && !standalone) return "install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return navigator.serviceWorker.getRegistration("/").then(async (reg) => ((await reg?.pushManager.getSubscription()) ? "on" : "off"));
}

export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    Promise.resolve(detect()).then(setState);
  }, []);

  function enable() {
    setMsg(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState("denied");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const res = await savePushSubscription(json, navigator.userAgent);
        setState(res.ok ? "on" : "off");
        if (res.ok) setMsg("Aktiviert. Tipp: einmal „Test senden“ drücken.");
      } catch {
        setMsg("Das hat nicht geklappt. Bitte Seite neu laden und nochmal versuchen.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMsg(null);
    });
  }

  function test() {
    startTransition(async () => {
      await sendTestPush();
      setMsg("Gesendet. Die Mitteilung sollte gleich erscheinen.");
    });
  }

  const btn = "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50";

  return (
    <div className="space-y-2 text-sm">
      {state === "loading" && <p className="text-neutral-400">…</p>}
      {state === "unsupported" && <p className="text-neutral-500">Dieser Browser unterstützt keine Benachrichtigungen.</p>}
      {state === "install" && (
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
          Auf dem iPhone geht das nur als App: in Safari unten auf <strong>Teilen</strong> tippen, dann{" "}
          <strong>„Zum Home-Bildschirm“</strong>. Danach die Paradiso-App öffnen und hier aktivieren.
        </p>
      )}
      {state === "denied" && (
        <p className="text-neutral-500">Benachrichtigungen sind für diese Seite blockiert. Das lässt sich in den Einstellungen des Geräts wieder erlauben.</p>
      )}
      {state === "off" && (
        <button onClick={enable} disabled={pending} className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          Auf diesem Gerät aktivieren
        </button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">Aktiv auf diesem Gerät</span>
          <button onClick={test} disabled={pending} className={btn}>
            Test senden
          </button>
          <button onClick={disable} disabled={pending} className={btn}>
            Ausschalten
          </button>
        </div>
      )}
      {msg && <p className="text-neutral-600">{msg}</p>}
    </div>
  );
}
