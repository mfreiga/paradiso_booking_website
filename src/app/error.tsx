"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a page crashes. The language comes from <html lang>, set by the layout.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-neutral-950 px-6 text-center text-neutral-100">
      <div>
        <h1 className="font-display text-4xl font-semibold">{en ? "Something went wrong" : "Da ist etwas schiefgelaufen"}</h1>
        <p className="mx-auto mt-3 max-w-sm text-neutral-400">
          {en ? "Please try again. If it keeps happening, just give us a call: 089 57933371." : "Bitte versuch es nochmal. Wenn es weiter nicht klappt, ruf uns einfach an: 089 57933371."}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={reset} className="rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600">
            {en ? "Try again" : "Nochmal versuchen"}
          </button>
          <Link href="/" className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium hover:bg-white/10">
            {en ? "Home page" : "Zur Startseite"}
          </Link>
        </div>
      </div>
    </main>
  );
}
