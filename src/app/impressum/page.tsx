import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Impressum" };

// TODO(shop): Inhaber:in, Rechtsform und USt-IdNr. vor dem Launch ergänzen.
export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-neutral-400 transition hover:text-white"
        >
          ← Zurück zur Startseite
        </Link>
        <h1 className="font-display mt-6 text-4xl font-semibold">Impressum</h1>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-neutral-300">
          <section>
            <h2 className="text-base font-semibold text-white">
              Angaben gemäß § 5 DDG
            </h2>
            <p className="mt-2">
              Hairstyling Paradiso
              <br />
              Inhaber:in: [Bitte ergänzen]
              <br />
              Augustenstraße 72
              <br />
              80333 München
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Kontakt</h2>
            <p className="mt-2">
              Telefon: 089 57933371
              <br />
              E-Mail: [Bitte ergänzen]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Umsatzsteuer-ID
            </h2>
            <p className="mt-2">
              Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: [Bitte
              ergänzen, falls vorhanden]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Verbraucherstreitbeilegung
            </h2>
            <p className="mt-2">
              Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
