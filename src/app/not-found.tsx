import Link from "next/link";
import { getLocale } from "@/lib/locale";

export default async function NotFound() {
  const en = (await getLocale()) === "en";
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-neutral-950 px-6 text-center text-neutral-100">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.35em] text-orange-400">404</p>
        <h1 className="font-display mt-3 text-4xl font-semibold">{en ? "Page not found" : "Seite nicht gefunden"}</h1>
        <p className="mx-auto mt-3 max-w-sm text-neutral-400">
          {en ? "This page doesn't exist (anymore). Maybe the link was mistyped." : "Diese Seite gibt es nicht (mehr). Vielleicht ist der Link vertippt."}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/" className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium hover:bg-white/10">
            {en ? "Home page" : "Zur Startseite"}
          </Link>
          <Link href="/book" className="rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600">
            {en ? "Book an appointment" : "Termin buchen"}
          </Link>
        </div>
      </div>
    </main>
  );
}
