import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

// TODO(shop): Verantwortliche:n benennen und Erklärung rechtlich prüfen lassen.
export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-neutral-400 transition hover:text-white"
        >
          ← Zurück zur Startseite
        </Link>
        <h1 className="font-display mt-6 text-4xl font-semibold">
          Datenschutzerklärung
        </h1>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-neutral-300">
          <section>
            <h2 className="text-base font-semibold text-white">
              1. Verantwortlicher
            </h2>
            <p className="mt-2">
              Hairstyling Paradiso, Inhaber:in: [Bitte ergänzen],
              Augustenstraße 72, 80333 München, Telefon: 089 57933371.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              2. Daten bei der Online-Terminbuchung
            </h2>
            <p className="mt-2">
              Wenn du online einen Termin buchst, verarbeiten wir die von dir
              angegebenen Daten (Name, E-Mail-Adresse, Telefonnummer,
              gewünschte Leistung, Terminzeit sowie optionale Anmerkungen)
              ausschließlich zur Durchführung und Verwaltung deines Termins
              (Art. 6 Abs. 1 lit. b DSGVO). Die Daten werden nicht an Dritte
              zu Werbezwecken weitergegeben.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              3. E-Mail-Benachrichtigungen
            </h2>
            <p className="mt-2">
              Zur Bestätigung deiner Buchung und für die Bitte um eine
              Bewertung nach deinem Termin versenden wir E-Mails über den
              Dienstleister Resend. Dabei wird deine E-Mail-Adresse an diesen
              Dienstleister übermittelt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">4. Hosting</h2>
            <p className="mt-2">
              Diese Website wird bei Netlify gehostet. Beim Aufruf der Seite
              werden technisch notwendige Daten (z.&nbsp;B. IP-Adresse,
              Zeitpunkt des Zugriffs) in Server-Logs verarbeitet.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              5. Externe Inhalte
            </h2>
            <p className="mt-2">
              Auf der Startseite ist eine Karte von Google Maps eingebettet.
              Beim Laden der Karte werden Daten (u.&nbsp;a. deine IP-Adresse)
              an Google übertragen. Anbieter: Google Ireland Limited, Gordon
              House, Barrow Street, Dublin 4, Irland.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              6. Deine Rechte
            </h2>
            <p className="mt-2">
              Du hast das Recht auf Auskunft, Berichtigung, Löschung und
              Einschränkung der Verarbeitung deiner personenbezogenen Daten
              sowie das Recht auf Datenübertragbarkeit und Beschwerde bei
              einer Aufsichtsbehörde. Wende dich dazu einfach an die oben
              genannten Kontaktdaten.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
