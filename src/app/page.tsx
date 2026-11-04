import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { LanguageSwitch } from "@/components/language-switch";
import { ConsentMap } from "@/components/consent-map";
import { siteUrl } from "@/lib/site-url";
import { barberBio } from "@/lib/service-i18n";
import { featuredPrices, type FeaturedPrice } from "@/lib/featured-prices";
import interiorWide from "@/assets/photos/interior-wide.jpg";
import storefront from "@/assets/photos/storefront.jpg";
import reception from "@/assets/photos/reception.jpg";
import stations from "@/assets/photos/stations.jpg";
import washBasins from "@/assets/photos/wash-basins.jpg";

export const dynamic = "force-dynamic";

// Fallbacks; the live phone/address come from the admin settings.
const DEFAULT_ADDRESS = "Augustenstraße 72, 80333 München";
const DEFAULT_PHONE = "089 57933371";
/** "089 57933371" → "+498957933371" for tel: links (German numbers). */
const telHref = (phone: string) => {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+49${digits.replace(/^0/, "")}`;
};
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

const SALON_PHOTOS = [
  { src: reception, alt: "reception" },
  { src: stations, alt: "stations" },
  { src: washBasins, alt: "washBasins" },
] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}/5`} className="text-amber-400">
      {"★".repeat(Math.round(rating))}
      <span className="text-neutral-700">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default async function HomePage() {
  const locale = await getLocale();
  const t = dict[locale].home;
  const weekdays = dict[locale].weekdaysLong;

  const [stylists, prices, setting] = await Promise.all([
    prisma.stylist.findMany({
      omit: { photoData: true },
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        reviews: { where: { status: "PUBLISHED" }, select: { rating: true } },
        workingHours: { select: { weekday: true, startMinutes: true, endMinutes: true } },
      },
    }),
    featuredPrices(),
    prisma.setting.findUnique({ where: { id: 1 }, select: { shopPhone: true, shopAddress: true } }),
  ]);
  const ADDRESS = setting?.shopAddress || DEFAULT_ADDRESS;
  const PHONE_DISPLAY = setting?.shopPhone || DEFAULT_PHONE;
  const PHONE_TEL = telHref(PHONE_DISPLAY);

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
  const fmtTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const navLinks: [string, string][] = [
    ["#preise", t.navServices],
    ["#team", t.navTeam],
    ["#fragen", t.navFaq],
    ["#anfahrt", t.navContact],
  ];

  const money = (cents: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  // Hidden when the service is deactivated/renamed in the admin area.
  const priceRow = (label: string, p: FeaturedPrice, highlight = false) =>
    p && (
      <li key={label} className="flex justify-between gap-4 text-neutral-300">
        <span>{label}</span>
        <span className={`shrink-0 font-medium ${highlight ? "text-orange-400" : "text-white"}`}>
          {p.from ? `${t.from} ` : ""}
          {money(p.cents)}
        </span>
      </li>
    );
  const h2 = "font-display text-3xl font-semibold sm:text-4xl";

  return (
    <main className="flex-1 bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <span className="font-display text-xl font-semibold tracking-wide">Paradiso</span>
          <nav className="hidden items-center gap-7 text-sm text-neutral-300 md:flex">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="transition hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitch locale={locale} />
            <Link
              href="/book"
              className="hidden whitespace-nowrap rounded-full bg-orange-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-orange-600 sm:inline-block"
            >
              {t.bookCta}
            </Link>
            {/* Phones: menu button with a vertical list */}
            <details className="group md:hidden">
              <summary
                aria-label={t.menu}
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-white/20 text-lg [&::-webkit-details-marker]:hidden"
              >
                <span className="group-open:hidden">☰</span>
                <span className="hidden group-open:inline">✕</span>
              </summary>
              <nav className="absolute inset-x-4 top-full rounded-2xl border border-white/10 bg-neutral-900/95 p-2 shadow-xl backdrop-blur">
                {navLinks.map(([href, label]) => (
                  <a key={href} href={href} className="block rounded-xl px-4 py-3 text-base text-neutral-200 hover:bg-white/5">
                    {label}
                  </a>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-10 pt-32 text-center sm:pb-16">
        <Image
          src={interiorWide}
          alt={t.heroImageAlt}
          fill
          preload
          sizes="100vw"
          placeholder="blur"
          className="scale-110 object-cover opacity-40 blur-[2px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,10,10,0.55), rgba(10,10,10,0.75) 60%, #0a0a0a), radial-gradient(ellipse 65% 55% at 50% 0%, rgba(249,115,22,0.30), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.35em] text-orange-400">{t.heroKicker}</p>
          <h1 className="font-display mt-3 text-6xl font-semibold tracking-tight sm:text-8xl">Paradiso</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-neutral-300">{t.heroTagline}</p>
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-neutral-200 backdrop-blur transition hover:bg-white/10"
          >
            <span className="font-semibold text-white">{GOOGLE_RATING}</span>
            <Stars rating={4} />
            <span className="text-neutral-400">
              · {GOOGLE_REVIEW_COUNT} {t.googleReviews}
            </span>
          </a>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/book"
              className="rounded-full bg-orange-500 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
            >
              {t.heroBook}
            </Link>
            <a href={`tel:${PHONE_TEL}`} className="rounded-full border border-white/20 px-8 py-3.5 text-base font-medium transition hover:bg-white/10">
              {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      {/* Prices */}
      <section id="preise" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-16 pt-8 sm:pt-12">
        <h2 className={`${h2} text-center`}>{t.servicesTitle}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <h3 className="font-display text-2xl font-semibold">{t.women}</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {t.womenList.map((label, i) => priceRow(label, prices.women[i]))}
            </ul>
            <p className="mt-5 text-xs text-neutral-500">{t.womenMore}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <h3 className="font-display text-2xl font-semibold">{t.men}</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {t.menList.map((label, i) => priceRow(label, prices.men[i]))}
            </ul>
            <p className="mt-5 text-xs text-neutral-500">{t.menMore}</p>
          </div>
          <div className="relative rounded-3xl border border-orange-500/40 bg-gradient-to-b from-orange-500/15 to-transparent p-7">
            <span className="absolute -top-3 right-6 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">{t.deal}</span>
            <h3 className="font-display text-2xl font-semibold">{t.students}</h3>
            <ul className="mt-5 space-y-3 text-sm">
              {t.studentsList.map((label, i) => priceRow(label, prices.students[i], true))}
            </ul>
            <p className="mt-5 text-xs text-neutral-400">{t.studentsNote}</p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/book"
            className="inline-block rounded-full border border-white/20 px-8 py-3 text-sm font-medium transition hover:border-orange-500 hover:text-orange-400"
          >
            {t.allServices}
          </Link>
        </div>
      </section>

      {/* Team + salon */}
      <section id="team" className="scroll-mt-20 border-y border-white/10 bg-white/[0.03] px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className={`${h2} text-center`}>{t.teamTitle}</h2>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {stylists.map((st) => {
              const count = st.reviews.length;
              const avg = count > 0 ? st.reviews.reduce((s, r) => s + r.rating, 0) / count : null;
              return (
                <div key={st.id} className="flex flex-col items-center rounded-2xl border border-white/10 bg-neutral-900 p-5 text-center">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full bg-orange-500/15 ring-1 ring-orange-500/40">
                    {st.photoUrl ? (
                      <Image src={st.photoUrl} alt={st.name} fill unoptimized sizes="96px" className="object-cover" />
                    ) : (
                      <span className="font-display flex h-full w-full items-center justify-center text-3xl font-semibold text-orange-400">
                        {st.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <h3 className="font-display text-lg font-semibold">{st.name}</h3>
                    <p className="text-xs uppercase tracking-wider text-neutral-500">{st.gender === "MALE" ? t.men : t.women}</p>
                    {avg !== null && (
                      <p className="mt-1 text-sm">
                        <Stars rating={avg} />
                      </p>
                    )}
                    {barberBio(st, locale) && <p className="mt-2 text-xs leading-relaxed text-neutral-400">{barberBio(st, locale)}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-2xl font-semibold">{t.salonTitle}</h3>
            <p className="text-sm text-neutral-400">{t.salonText}</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {SALON_PHOTOS.map((p) => (
              <div key={p.alt} className="relative h-32 overflow-hidden rounded-2xl border border-white/10 sm:h-52">
                <Image src={p.src} alt={t.salonAlts[p.alt]} fill placeholder="blur" sizes="(max-width: 640px) 33vw, 380px" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className={`${h2} text-center`}>{t.reviewsTitle}</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center transition hover:border-orange-500/50"
          >
            <span className="font-display text-5xl font-semibold text-white">{GOOGLE_RATING}</span>
            <span className="mt-2 text-lg">
              <Stars rating={4} />
            </span>
            <span className="mt-2 text-sm text-neutral-400">
              {GOOGLE_REVIEW_COUNT} {t.reviewsOnGoogle}
            </span>
            <span className="mt-3 text-sm font-medium text-orange-400">{t.readAllGoogle} →</span>
          </a>
          {GOOGLE_REVIEWS.map((r) => (
            <figure key={r.name} className="rounded-3xl border border-white/10 bg-neutral-900 p-6">
              <Stars rating={r.rating} />
              <blockquote className="mt-3 text-sm leading-relaxed text-neutral-300">„{r.text}“</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-neutral-500"> · {t.onGoogle}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="fragen" className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-16">
        <h2 className={`${h2} text-center`}>{t.faqTitle}</h2>
        <div className="mt-8 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          {t.faq.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-6 px-6 py-5 text-[15px] font-medium transition marker:content-none hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-400 transition-transform duration-200 group-open:rotate-180">
                  <ChevronIcon className="h-4 w-4" />
                </span>
              </summary>
              <p className="px-6 pb-6 text-sm leading-relaxed text-neutral-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Directions */}
      <section id="anfahrt" className="scroll-mt-20 border-t border-white/10 px-6 py-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2">
          <div>
            <h2 className={h2}>{t.contactTitle}</h2>
            <dl className="mt-8 space-y-5 text-sm">
              <div>
                <dt className="text-neutral-500">{t.address}</dt>
                <dd className="mt-1 text-base">{ADDRESS}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">{t.phone}</dt>
                <dd className="mt-1 text-base">
                  <a href={`tel:${PHONE_TEL}`} className="hover:text-orange-400">
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
                          <span className={h ? "" : "text-neutral-500"}>{h ? `${fmtTime(h.start)}–${fmtTime(h.end)}` : t.closed}</span>
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium transition hover:border-orange-500 hover:text-orange-400"
              >
                {t.route}
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium transition hover:border-orange-500 hover:text-orange-400"
              >
                <InstagramIcon className="h-4 w-4" />
                {INSTAGRAM_HANDLE}
              </a>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-5">
            <figure className="relative overflow-hidden rounded-3xl border border-white/10 sm:col-span-2">
              <Image
                src={storefront}
                alt={t.storefrontAlt}
                placeholder="blur"
                sizes="(max-width: 640px) 100vw, 220px"
                className="h-full max-h-80 w-full object-cover"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-950/90 to-transparent px-4 pb-3 pt-10 text-xs text-neutral-200">
                {t.storefrontCaption}
              </figcaption>
            </figure>
            <div className="overflow-hidden rounded-3xl border border-white/10 sm:col-span-3">
              <ConsentMap
                title={t.mapTitle}
                src="https://www.google.com/maps?q=Hairstyling+Paradiso+Augustenstra%C3%9Fe+72+80333+M%C3%BCnchen&output=embed"
                loadLabel={t.mapLoad}
                consentText={t.mapConsent}
                className="h-72 w-full sm:h-full sm:min-h-80"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-10 text-sm text-neutral-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-center sm:text-left">
            <span className="font-display text-lg font-semibold text-white">Paradiso</span>
            <p className="mt-1">{ADDRESS}</p>
          </div>
          <div className="flex items-center gap-6">
            <a href={`tel:${PHONE_TEL}`} className="hover:text-white">
              {PHONE_DISPLAY}
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-white">
              <InstagramIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-6xl border-t border-white/10 pt-5 text-center text-xs text-neutral-600 sm:text-left">
          © {new Date().getFullYear()} Hairstyling Paradiso ·{" "}
          <Link href="/impressum" className="underline underline-offset-2 hover:text-neutral-400">
            {t.impressum}
          </Link>{" "}
          ·{" "}
          <Link href="/datenschutz" className="underline underline-offset-2 hover:text-neutral-400">
            {t.privacy}
          </Link>{" "}
          ·{" "}
          <Link href="/admin" className="underline underline-offset-2 hover:text-neutral-400">
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
            url: siteUrl(),
            image: `${siteUrl()}/opengraph-image.jpg`,
            sameAs: [INSTAGRAM_URL],
            openingHoursSpecification: [
              {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                opens: "09:00",
                closes: "20:00",
              },
              { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "19:00" },
            ],
            priceRange: "€€",
          }),
        }}
      />
    </main>
  );
}
