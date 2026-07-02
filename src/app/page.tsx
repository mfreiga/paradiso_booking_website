import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Real shop data (Google Business profile)
const ADDRESS = "Augustenstraße 72, 80333 München";
const PHONE_DISPLAY = "089 57933371";
const PHONE_TEL = "+498957933371";
const GOOGLE_RATING = "4,3";
const GOOGLE_REVIEW_COUNT = 382;
const GOOGLE_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Hairstyling+Paradiso+Augustenstra%C3%9Fe+72+M%C3%BCnchen";
const INSTAGRAM_URL = "https://www.instagram.com/paradiso_augustenstr_72_/";
const INSTAGRAM_HANDLE = "@paradiso_augustenstr_72_";

// Real customer voices from the Google Business profile (shared by the shop).
const GOOGLE_REVIEWS = [
  {
    name: "Kareem Taha",
    rating: 5,
    text: "Ich habe immer eine tolle Erfahrung im Friseursalon/Barbershop. Der Friseur ist sehr kompetent und nimmt sich Zeit, genau zu verstehen, was ich möchte. Er liefert immer einen perfekten Haarschnitt.",
  },
  {
    name: "Josef Beham-El Parony",
    rating: 5,
    text: "Top! Es gibt kein anderes Wort, was den Service, den Schnitt und die Leute hier beschreibt. Nachdem ich mehr als 20 unterschiedliche Friseure hier in München besucht habe, wurde ich nie so herzlich aufgenommen wie hier.",
  },
];

const FAQ = [
  {
    q: "Muss ich online buchen oder kann ich einfach vorbeikommen?",
    a: "Beides! Online sicherst du dir deinen Wunschtermin ohne Wartezeit — Walk-ins sind aber jederzeit willkommen, solange ein Platz frei ist.",
  },
  {
    q: "Wie funktioniert der Studentenrabatt?",
    a: "Einfach beim Termin deinen gültigen Studierendenausweis zeigen: Schneiden 11 €, Schneiden mit Seiten 0 mm und Übergang 16 €.",
  },
  {
    q: "Kann ich meinen Termin stornieren oder verschieben?",
    a: "Ja — über den Link in deiner Buchung kannst du bis kurz vor dem Termin kostenlos online stornieren. Danach ruf uns einfach kurz an.",
  },
  {
    q: "Wie bezahle ich?",
    a: "Bezahlt wird bequem vor Ort im Salon.",
  },
  {
    q: "Wie erreiche ich euch?",
    a: "Augustenstraße 72 in der Maxvorstadt — wenige Gehminuten von den U-Bahn-Stationen Theresienstraße (U2) und Stiglmaierplatz (U1).",
  },
];

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
  7: "Sonntag",
};

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} von 5 Sternen`} className="text-amber-400">
      {"★".repeat(Math.round(rating))}
      <span className="text-neutral-700">
        {"★".repeat(5 - Math.round(rating))}
      </span>
    </span>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default async function HomePage() {
  const stylists = await prisma.stylist.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      reviews: { where: { status: "PUBLISHED" }, select: { rating: true } },
      workingHours: {
        select: { weekday: true, startMinutes: true, endMinutes: true },
      },
    },
  });

  // Shop hours = union of all barbers' working hours per weekday.
  const hoursByDay = new Map<number, { start: number; end: number }>();
  for (const st of stylists) {
    for (const h of st.workingHours) {
      const cur = hoursByDay.get(h.weekday);
      hoursByDay.set(h.weekday, {
        start: Math.min(cur?.start ?? h.startMinutes, h.startMinutes),
        end: Math.max(cur?.end ?? h.endMinutes, h.endMinutes),
      });
    }
  }
  const fmtTime = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  return (
    <main className="flex-1 bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-semibold tracking-wide">
            Paradiso
          </span>
          <nav className="hidden items-center gap-8 text-sm text-neutral-300 sm:flex">
            <a href="#leistungen" className="transition hover:text-white">
              Leistungen
            </a>
            <a href="#team" className="transition hover:text-white">
              Team
            </a>
            <a href="#kontakt" className="transition hover:text-white">
              Kontakt
            </a>
          </nav>
          <Link
            href="/book"
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
          >
            Termin buchen
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-28 pt-40 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 50% 0%, rgba(249,115,22,0.28), transparent), radial-gradient(ellipse 40% 35% at 85% 100%, rgba(249,115,22,0.08), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-orange-400">
            Hairstyling
          </p>
          <h1 className="font-display mt-3 text-6xl font-semibold tracking-tight sm:text-8xl">
            Paradiso
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-300">
            Dein Friseursalon mitten in der Maxvorstadt — für Damen und Herren.
            Vom präzisen Fade über Bartpflege bis Balayage.
          </p>
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-neutral-200 backdrop-blur transition hover:bg-white/10"
          >
            <span className="font-semibold text-white">{GOOGLE_RATING}</span>
            <Stars rating={4} />
            <span className="text-neutral-400">
              · {GOOGLE_REVIEW_COUNT} Google-Bewertungen
            </span>
          </a>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/book"
              className="rounded-full bg-orange-500 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
            >
              Jetzt Termin buchen
            </Link>
            <a
              href={`tel:${PHONE_TEL}`}
              className="rounded-full border border-white/20 px-8 py-3.5 text-base font-medium transition hover:bg-white/10"
            >
              {PHONE_DISPLAY}
            </a>
          </div>
          <p className="mt-6 text-sm text-neutral-500">{ADDRESS}</p>
        </div>
      </section>

      {/* Services & prices */}
      <section id="leistungen" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <p className="text-center text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
          Leistungen &amp; Preise
        </p>
        <h2 className="font-display mt-3 text-center text-4xl font-semibold">
          Was darf&apos;s sein?
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Damen */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h3 className="font-display text-2xl font-semibold">Damen</h3>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Waschen, Schneiden, Föhnen</span>
                <span className="shrink-0 font-medium text-white">ab 36 €</span>
              </li>
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Farbe</span>
                <span className="shrink-0 font-medium text-white">ab 42 €</span>
              </li>
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Foliensträhnen</span>
                <span className="shrink-0 font-medium text-white">ab 38 €</span>
              </li>
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Balayage (inkl. Glossing)</span>
                <span className="shrink-0 font-medium text-white">ab 98 €</span>
              </li>
            </ul>
            <p className="mt-5 text-xs text-neutral-500">
              Außerdem: Pflege, Dauerwelle, Keratin, Make-up, Hochstecken u.&nbsp;v.&nbsp;m.
            </p>
          </div>
          {/* Herren */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h3 className="font-display text-2xl font-semibold">Herren</h3>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Schneiden</span>
                <span className="shrink-0 font-medium text-white">16 €</span>
              </li>
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Schneiden (Seiten 0 mm)</span>
                <span className="shrink-0 font-medium text-white">19 €</span>
              </li>
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Waschen, Schneiden, Styling</span>
                <span className="shrink-0 font-medium text-white">19 €</span>
              </li>
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Bart mit Übergang</span>
                <span className="shrink-0 font-medium text-white">14 €</span>
              </li>
            </ul>
            <p className="mt-5 text-xs text-neutral-500">
              Außerdem: Nassrasur, Bart Kontur, Farbe &amp; Tönung, Glättung u.&nbsp;v.&nbsp;m.
            </p>
          </div>
          {/* Studenten */}
          <div className="relative rounded-3xl border border-orange-500/40 bg-gradient-to-b from-orange-500/15 to-transparent p-8">
            <span className="absolute -top-3 right-6 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
              Deal
            </span>
            <h3 className="font-display text-2xl font-semibold">
              Studentenrabatt
            </h3>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Schneiden</span>
                <span className="shrink-0 font-medium text-orange-400">11 €</span>
              </li>
              <li className="flex justify-between gap-4 text-neutral-300">
                <span>Schneiden (Seiten 0 mm mit Übergang)</span>
                <span className="shrink-0 font-medium text-orange-400">16 €</span>
              </li>
            </ul>
            <p className="mt-5 text-xs text-neutral-400">
              Einfach Studierendenausweis mitbringen — mitten im Uni-Viertel,
              gemacht für dich.
            </p>
          </div>
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/book"
            className="inline-block rounded-full border border-white/20 px-8 py-3 text-sm font-medium transition hover:border-orange-500 hover:text-orange-400"
          >
            Alle Leistungen &amp; Preise → Termin buchen
          </Link>
        </div>
      </section>

      {/* Team */}
      <section id="team" className="scroll-mt-20 border-y border-white/10 bg-white/[0.03] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
            Team
          </p>
          <h2 className="font-display mt-3 text-center text-4xl font-semibold">
            Deine Friseur:innen
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {stylists.map((st) => {
              const count = st.reviews.length;
              const avg =
                count > 0
                  ? st.reviews.reduce((s, r) => s + r.rating, 0) / count
                  : null;
              return (
                <div
                  key={st.id}
                  className="flex flex-col items-center rounded-3xl border border-white/10 bg-neutral-900 p-6 text-center transition hover:border-orange-500/50"
                >
                  <div className="font-display flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/15 text-2xl font-semibold text-orange-400 ring-1 ring-orange-500/40">
                    {st.name.charAt(0)}
                  </div>
                  <h3 className="font-display mt-4 text-lg font-semibold">
                    {st.name}
                  </h3>
                  <p className="mt-0.5 text-xs uppercase tracking-wider text-neutral-500">
                    {st.gender === "MALE" ? "Herren" : "Damen"}
                  </p>
                  {avg !== null && (
                    <p className="mt-2 text-sm">
                      <Stars rating={avg} />
                    </p>
                  )}
                  {st.bio && (
                    <p className="mt-3 text-xs leading-relaxed text-neutral-400">
                      {st.bio}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-center text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
          Bewertungen
        </p>
        <h2 className="font-display mt-3 text-center text-4xl font-semibold">
          Das sagen unsere Kund:innen
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center transition hover:border-orange-500/50"
          >
            <span className="font-display text-5xl font-semibold text-white">
              {GOOGLE_RATING}
            </span>
            <span className="mt-2 text-lg">
              <Stars rating={4} />
            </span>
            <span className="mt-2 text-sm text-neutral-400">
              {GOOGLE_REVIEW_COUNT} Bewertungen bei Google
            </span>
            <span className="mt-4 text-sm font-medium text-orange-400">
              Alle auf Google lesen →
            </span>
          </a>
          {GOOGLE_REVIEWS.map((r) => (
            <figure
              key={r.name}
              className="rounded-3xl border border-white/10 bg-neutral-900 p-6"
            >
              <Stars rating={r.rating} />
              <blockquote className="mt-3 text-sm leading-relaxed text-neutral-300">
                „{r.text}“
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-neutral-500"> · auf Google</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <p className="text-center text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
          FAQ
        </p>
        <h2 className="font-display mt-3 text-center text-4xl font-semibold">
          Gut zu wissen
        </h2>
        <div className="mt-10 space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-white/10 bg-white/5"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium marker:content-none">
                {f.q}
                <span className="text-orange-400 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-neutral-400">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Instagram */}
      <section className="border-y border-white/10 bg-white/[0.03] px-6 py-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <InstagramIcon className="h-10 w-10 text-orange-400" />
          <h2 className="font-display mt-4 text-3xl font-semibold">
            Folge uns auf Instagram
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            Frische Cuts, Vorher-Nachher und ein Blick hinter die Kulissen in
            der Augustenstraße.
          </p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 rounded-full bg-orange-500 px-8 py-3 text-sm font-medium text-white transition hover:bg-orange-600"
          >
            {INSTAGRAM_HANDLE}
          </a>
        </div>
      </section>

      {/* Location */}
      <section id="kontakt" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
              Mitten in der Maxvorstadt
            </p>
            <h2 className="font-display mt-3 text-4xl font-semibold">
              So findest du uns
            </h2>
            <p className="mt-5 leading-relaxed text-neutral-300">
              Zentral gelegen in der Augustenstraße — perfekt erreichbar aus dem
              Uni-Viertel und der Innenstadt.
            </p>
            <dl className="mt-8 space-y-4 text-sm">
              <div>
                <dt className="text-neutral-500">Adresse</dt>
                <dd className="mt-1 text-base">{ADDRESS}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Telefon</dt>
                <dd className="mt-1 text-base">
                  <a href={`tel:${PHONE_TEL}`} className="hover:text-orange-400">
                    {PHONE_DISPLAY}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Öffnungszeiten</dt>
                <dd className="mt-2">
                  <ul className="max-w-xs space-y-1 text-neutral-300">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const h = hoursByDay.get(day);
                      return (
                        <li key={day} className="flex justify-between gap-6">
                          <span>{WEEKDAY_LABELS[day]}</span>
                          <span className={h ? "" : "text-neutral-500"}>
                            {h
                              ? `${fmtTime(h.start)} – ${fmtTime(h.end)}`
                              : "Geschlossen"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </div>
            </dl>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block rounded-full border border-white/20 px-7 py-3 text-sm font-medium transition hover:border-orange-500 hover:text-orange-400"
            >
              Route planen →
            </a>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/10">
            <iframe
              title="Karte: Hairstyling Paradiso, Augustenstraße 72, München"
              src="https://www.google.com/maps?q=Hairstyling+Paradiso+Augustenstra%C3%9Fe+72+80333+M%C3%BCnchen&output=embed"
              className="h-96 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl rounded-3xl bg-gradient-to-r from-orange-600 to-orange-500 px-8 py-12 text-center">
          <h2 className="font-display text-3xl font-semibold text-white">
            Bereit für deinen nächsten Termin?
          </h2>
          <p className="mt-2 text-orange-100">
            Online buchen dauert keine 60 Sekunden.
          </p>
          <Link
            href="/book"
            className="mt-6 inline-block rounded-full bg-neutral-950 px-8 py-3.5 text-base font-medium text-white transition hover:bg-neutral-800"
          >
            Jetzt Termin buchen
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-12 text-sm text-neutral-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <span className="font-display text-lg font-semibold text-white">
              Paradiso
            </span>
            <p className="mt-1">{ADDRESS}</p>
          </div>
          <div className="flex items-center gap-6">
            <a href={`tel:${PHONE_TEL}`} className="hover:text-white">
              {PHONE_DISPLAY}
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:text-white"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t border-white/10 pt-6 text-xs text-neutral-600">
          © {new Date().getFullYear()} Hairstyling Paradiso ·{" "}
          <Link
            href="/impressum"
            className="underline underline-offset-2 hover:text-neutral-400"
          >
            Impressum
          </Link>{" "}
          ·{" "}
          <Link
            href="/datenschutz"
            className="underline underline-offset-2 hover:text-neutral-400"
          >
            Datenschutz
          </Link>{" "}
          ·{" "}
          <Link
            href="/admin"
            className="underline underline-offset-2 hover:text-neutral-400"
          >
            Adminbereich
          </Link>
        </p>
      </footer>

      {/* Structured data so Google shows the salon with hours & rating context */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HairSalon",
            name: "Hairstyling Paradiso",
            telephone: "+49 89 57933371",
            address: {
              "@type": "PostalAddress",
              streetAddress: "Augustenstraße 72",
              postalCode: "80333",
              addressLocality: "München",
              addressCountry: "DE",
            },
            url: "https://hairstylingparadiso.netlify.app",
            sameAs: [INSTAGRAM_URL],
            openingHoursSpecification: [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                opens: "09:00",
                closes: "20:00",
              },
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: "Saturday",
                opens: "09:00",
                closes: "19:00",
              },
            ],
            priceRange: "€€",
          }),
        }}
      />
    </main>
  );
}
