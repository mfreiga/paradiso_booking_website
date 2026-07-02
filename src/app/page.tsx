import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { LanguageSwitch } from "@/components/language-switch";

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

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-amber-400">
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default async function HomePage() {
  const locale = await getLocale();
  const t = dict[locale].home;
  const weekdays = dict[locale].weekdaysLong;

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

  const priceRow = (label: string, price: string, highlight = false) => (
    <li key={label} className="flex justify-between gap-4 text-neutral-300">
      <span>{label}</span>
      <span
        className={`shrink-0 font-medium ${highlight ? "text-orange-400" : "text-white"}`}
      >
        {price}
      </span>
    </li>
  );

  return (
    <main className="flex-1 bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <span className="font-display text-xl font-semibold tracking-wide">
            Paradiso
          </span>
          <nav className="hidden items-center gap-7 text-sm text-neutral-300 md:flex">
            <a href="#leistungen" className="transition hover:text-white">
              {t.navServices}
            </a>
            <a href="#team" className="transition hover:text-white">
              {t.navTeam}
            </a>
            <a href="#faq" className="transition hover:text-white">
              {t.navFaq}
            </a>
            <a href="#kontakt" className="transition hover:text-white">
              {t.navContact}
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitch locale={locale} />
            <Link
              href="/book"
              className="rounded-full bg-orange-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
            >
              {t.bookCta}
            </Link>
          </div>
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
            {t.heroKicker}
          </p>
          <h1 className="font-display mt-3 text-6xl font-semibold tracking-tight sm:text-8xl">
            Paradiso
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-300">
            {t.heroTagline}
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
              · {GOOGLE_REVIEW_COUNT} {t.googleReviews}
            </span>
          </a>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/book"
              className="rounded-full bg-orange-500 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
            >
              {t.heroBook}
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
      <section
        id="leistungen"
        className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20"
      >
        <p className="text-center text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
          {t.servicesKicker}
        </p>
        <h2 className="font-display mt-3 text-center text-4xl font-semibold">
          {t.servicesTitle}
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Women */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h3 className="font-display text-2xl font-semibold">{t.women}</h3>
            <ul className="mt-6 space-y-3 text-sm">
              {priceRow(t.womenList[0], `${t.from} 36 €`)}
              {priceRow(t.womenList[1], `${t.from} 42 €`)}
              {priceRow(t.womenList[2], `${t.from} 38 €`)}
              {priceRow(t.womenList[3], `${t.from} 98 €`)}
            </ul>
            <p className="mt-5 text-xs text-neutral-500">{t.womenMore}</p>
          </div>
          {/* Men */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h3 className="font-display text-2xl font-semibold">{t.men}</h3>
            <ul className="mt-6 space-y-3 text-sm">
              {priceRow(t.menList[0], "16 €")}
              {priceRow(t.menList[1], "19 €")}
              {priceRow(t.menList[2], "19 €")}
              {priceRow(t.menList[3], "14 €")}
            </ul>
            <p className="mt-5 text-xs text-neutral-500">{t.menMore}</p>
          </div>
          {/* Students */}
          <div className="relative rounded-3xl border border-orange-500/40 bg-gradient-to-b from-orange-500/15 to-transparent p-8">
            <span className="absolute -top-3 right-6 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">
              {t.deal}
            </span>
            <h3 className="font-display text-2xl font-semibold">
              {t.students}
            </h3>
            <ul className="mt-6 space-y-3 text-sm">
              {priceRow(t.studentsList[0], "11 €", true)}
              {priceRow(t.studentsList[1], "16 €", true)}
            </ul>
            <p className="mt-5 text-xs text-neutral-400">{t.studentsNote}</p>
          </div>
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/book"
            className="inline-block rounded-full border border-white/20 px-8 py-3 text-sm font-medium transition hover:border-orange-500 hover:text-orange-400"
          >
            {t.allServices}
          </Link>
        </div>
      </section>

      {/* Team */}
      <section
        id="team"
        className="scroll-mt-20 border-y border-white/10 bg-white/[0.03] px-6 py-20"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
            {t.teamKicker}
          </p>
          <h2 className="font-display mt-3 text-center text-4xl font-semibold">
            {t.teamTitle}
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
                    {st.gender === "MALE" ? t.men : t.women}
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
          {t.reviewsKicker}
        </p>
        <h2 className="font-display mt-3 text-center text-4xl font-semibold">
          {t.reviewsTitle}
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
              {GOOGLE_REVIEW_COUNT} {t.reviewsOnGoogle}
            </span>
            <span className="mt-4 text-sm font-medium text-orange-400">
              {t.readAllGoogle}
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
                <span className="text-neutral-500"> · {t.onGoogle}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-24">
        <p className="text-center text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
          {t.faqKicker}
        </p>
        <h2 className="font-display mt-3 text-center text-4xl font-semibold">
          {t.faqTitle}
        </h2>
        <div className="mt-10 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          {t.faq.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-6 px-6 py-5 text-[15px] font-medium transition marker:content-none hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-400 transition-transform duration-200 group-open:rotate-180">
                  <ChevronIcon className="h-4 w-4" />
                </span>
              </summary>
              <p className="px-6 pb-6 text-sm leading-relaxed text-neutral-400">
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
            {t.igTitle}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            {t.igText}
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
      <section
        id="kontakt"
        className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20"
      >
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
              {t.locationKicker}
            </p>
            <h2 className="font-display mt-3 text-4xl font-semibold">
              {t.locationTitle}
            </h2>
            <p className="mt-5 leading-relaxed text-neutral-300">
              {t.locationText}
            </p>
            <dl className="mt-8 space-y-4 text-sm">
              <div>
                <dt className="text-neutral-500">{t.address}</dt>
                <dd className="mt-1 text-base">{ADDRESS}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t.phone}</dt>
                <dd className="mt-1 text-base">
                  <a
                    href={`tel:${PHONE_TEL}`}
                    className="hover:text-orange-400"
                  >
                    {PHONE_DISPLAY}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t.hours}</dt>
                <dd className="mt-2">
                  <ul className="max-w-xs space-y-1 text-neutral-300">
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const h = hoursByDay.get(day);
                      return (
                        <li key={day} className="flex justify-between gap-6">
                          <span>{weekdays[day]}</span>
                          <span className={h ? "" : "text-neutral-500"}>
                            {h
                              ? `${fmtTime(h.start)} – ${fmtTime(h.end)}`
                              : t.closed}
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
              {t.route}
            </a>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/10">
            <iframe
              title={t.mapTitle}
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
            {t.ctaTitle}
          </h2>
          <p className="mt-2 text-orange-100">{t.ctaText}</p>
          <Link
            href="/book"
            className="mt-6 inline-block rounded-full bg-neutral-950 px-8 py-3.5 text-base font-medium text-white transition hover:bg-neutral-800"
          >
            {t.heroBook}
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
            {t.impressum}
          </Link>{" "}
          ·{" "}
          <Link
            href="/datenschutz"
            className="underline underline-offset-2 hover:text-neutral-400"
          >
            {t.privacy}
          </Link>{" "}
          ·{" "}
          <Link
            href="/admin"
            className="underline underline-offset-2 hover:text-neutral-400"
          >
            {t.admin}
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
                dayOfWeek: [
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                ],
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
