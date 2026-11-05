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
              angegebenen Daten (Name, E-Mail-Adresse, freiwillig deine
              Telefonnummer, gewünschte Leistung, Terminzeit sowie optionale
              Anmerkungen) ausschließlich zur Durchführung und Verwaltung
              deines Termins (Art. 6 Abs. 1 lit. b DSGVO). Die Daten werden
              nicht an Dritte zu Werbezwecken weitergegeben.
            </p>
            <p className="mt-2">
              Zwölf Monate nach deinem Termin löschen wir Name, E-Mail-Adresse,
              Telefonnummer und Anmerkung automatisch. Übrig bleiben nur
              anonyme Angaben (Datum, Leistung, Preis). Eine veröffentlichte
              Bewertung bleibt mit deinem Vornamen und dem ersten Buchstaben
              deines Nachnamens stehen, bis du uns bittest, sie zu löschen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              3. E-Mail-Benachrichtigungen
            </h2>
            <p className="mt-2">
              Wir schicken dir E-Mails zu deinem Termin: die Bestätigung (mit
              Kalendereintrag), eine Erinnerung am Tag davor, eine Nachricht,
              wenn der Termin verschoben oder abgesagt wird, und nach dem
              Termin die Bitte um eine Bewertung (Art. 6 Abs. 1 lit. b und f
              DSGVO). Für den Versand nutzen wir einen E-Mail-Dienstleister
              (Google Ireland Limited für Gmail bzw. Resend Inc.), an den
              dafür deine E-Mail-Adresse und der Inhalt der Nachricht
              übermittelt werden. Wenn du keine Bewertungsanfrage möchtest,
              antworte einfach kurz auf eine unserer E-Mails.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">4. Hosting und Datenbank</h2>
            <p className="mt-2">
              Diese Website wird bei Netlify gehostet. Beim Aufruf der Seite
              werden technisch notwendige Daten (z.&nbsp;B. IP-Adresse,
              Zeitpunkt des Zugriffs) in Server-Logs verarbeitet. Die
              Termindaten liegen in einer Datenbank bei Neon (Rechenzentrum in
              Frankfurt am Main).
            </p>
            <p className="mt-2">
              Wir setzen ein einziges Cookie („lang“), das sich deine gewählte
              Sprache (Deutsch oder Englisch) merkt. Es ist technisch nötig,
              enthält keine persönlichen Daten und wird nicht zur Analyse
              genutzt. Statistik- oder Werbe-Tracking gibt es auf dieser
              Website nicht. (Nur im internen Adminbereich für unser Team
              kommen technisch nötige Login-Cookies hinzu.)
            </p>
            <p className="mt-2">
              Damit wir neue Buchungen sofort sehen, bekommt das zuständige
              Team-Mitglied eine Benachrichtigung aufs Handy (mit Name, Uhrzeit
              und Leistung). Diese Mitteilungen sind Ende-zu-Ende
              verschlüsselt; der Übermittlungsdienst des Handys (Apple bzw.
              Google) kann den Inhalt nicht lesen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              5. Externe Inhalte
            </h2>
            <p className="mt-2">
              Auf der Startseite kannst du eine Karte von Google Maps
              einblenden. Sie wird erst geladen, wenn du auf „Karte anzeigen“
              klickst (Art. 6 Abs. 1 lit. a DSGVO). Erst dann werden Daten
              (u.&nbsp;a. deine IP-Adresse) an Google übertragen. Anbieter:
              Google Ireland Limited, Gordon House, Barrow Street, Dublin 4,
              Irland.
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
