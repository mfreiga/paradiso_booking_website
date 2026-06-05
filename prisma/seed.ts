import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ── helpers ───────────────────────────────────────────────────
type PriceType = "FIXED" | "FROM" | "ON_REQUEST";
const v = (
  label: string,
  eur: number,
  durationMinutes: number,
  priceType: PriceType = "FIXED",
) => ({ label, priceCents: Math.round(eur * 100), durationMinutes, priceType });

type ServiceSeed = {
  name: string;
  isAddOn?: boolean;
  isPopular?: boolean;
  variants: ReturnType<typeof v>[];
};
type CategorySeed = {
  name: string;
  gender: "MEN" | "WOMEN" | "UNISEX";
  services: ServiceSeed[];
};

// ── catalog (transcribed from Paradiso Preisliste 2026 — SPEC §9) ──
// Durations are the PROPOSED estimates; the shop refines them in admin.
const catalog: CategorySeed[] = [
  // ───────── DAMEN (Women) ─────────
  {
    name: "Schneiden & Styling",
    gender: "WOMEN",
    services: [
      { name: "Schneiden, Trocknen", variants: [v("Kurz", 27, 30), v("Mittel", 32, 40), v("Lang", 39, 45)] },
      { name: "Waschen, Schneiden, Föhnen", isPopular: true, variants: [v("Kurz", 36, 45), v("Mittel", 46, 60), v("Lang", 56, 75)] },
      { name: "Waschen, Schneiden, Trocknen", variants: [v("Kurz", 30, 40), v("Mittel", 35, 50), v("Lang", 41, 60)] },
      { name: "Waschen, Föhnen/legen", variants: [v("Kurz", 26, 30), v("Mittel", 31, 40), v("Lang", 38, 45)] },
      { name: "Nur Föhnen (ohne Waschen)", variants: [v("Kurz", 23, 20), v("Mittel", 28, 30), v("Lang", 34, 40)] },
      { name: "Pony schneiden", isAddOn: true, variants: [v("Standard", 7, 10)] },
      { name: "Augenbrauen", isAddOn: true, variants: [v("Standard", 7, 10)] },
    ],
  },
  {
    name: "Pflege",
    gender: "WOMEN",
    services: [
      { name: "Conditioner", isAddOn: true, variants: [v("Standard", 3, 5)] },
      { name: "Intensive Kur", isAddOn: true, variants: [v("Standard", 6, 10)] },
      { name: "Haare Waschen", isAddOn: true, variants: [v("Standard", 8, 10)] },
      { name: "Vitaplex (inkl. Kopfmassage)", isAddOn: true, variants: [v("Standard", 15, 20)] },
    ],
  },
  {
    name: "Färben",
    gender: "WOMEN",
    services: [
      { name: "Ansatzfarbe", variants: [v("Kurz", 37, 45), v("Mittel (2 cm)", 48, 60)] },
      { name: "Farbe", variants: [v("Kurz", 42, 60), v("Mittel", 48, 75), v("Lang", 57, 90)] },
      { name: "Tönung", variants: [v("Kurz", 35, 45), v("Mittel", 41, 60), v("Lang", 48, 75)] },
    ],
  },
  {
    name: "Blondierung",
    gender: "WOMEN",
    services: [
      { name: "Ansätze Blondierung", variants: [v("Kurz", 39, 60), v("Mittel", 48, 75), v("Lang", 58, 90)] },
      { name: "Softaufhellung (Blondierwäsche)", variants: [v("Kurz", 42, 90), v("Mittel", 47, 105), v("Lang", 57, 120)] },
      { name: "Glossing (Abmattierung)", variants: [v("Kurz", 10, 20), v("Mittel", 15, 25), v("Lang", 25, 30)] },
    ],
  },
  {
    name: "Strähnen",
    gender: "WOMEN",
    services: [
      { name: "Haubensträhnen", variants: [v("Standard", 26, 45, "FROM")] },
      { name: "Foliensträhnen (Oberkopf)", variants: [v("Kurz", 38, 60), v("Mittel", 46, 75), v("Lang", 51, 90)] },
      { name: "Foliensträhnen (halber Kopf)", variants: [v("Kurz", 44, 75), v("Mittel", 49, 90), v("Lang", 55, 105)] },
      { name: "Foliensträhnen (ganzer Kopf)", variants: [v("Kurz", 51, 90), v("Mittel", 59, 105), v("Lang", 69, 120)] },
      { name: "Balayage (inkl. Glossing)", variants: [v("Mittel", 98, 150, "FROM"), v("Lang", 129, 180, "FROM")] },
    ],
  },
  {
    name: "Dauerhafte Umformung",
    gender: "WOMEN",
    services: [
      { name: "Dauerwelle klassisch", variants: [v("Kurz", 55, 90), v("Mittel", 65, 105), v("Lang", 75, 120)] },
      { name: "Dauerwelle mit Technik", variants: [v("Standard", 55, 120, "FROM")] },
    ],
  },
  {
    name: "Keratinbehandlung",
    gender: "WOMEN",
    services: [
      { name: "Keratinbehandlung inkl. Glättung", variants: [v("Standard", 130, 150, "FROM")] },
      { name: "Haar-Botox", variants: [v("Standard", 120, 90, "FROM")] },
      { name: "Flächen", variants: [v("Standard", 15, 30, "FROM")] },
    ],
  },
  {
    name: "Mädchen bis 10 Jahre",
    gender: "WOMEN",
    services: [
      { name: "Schneiden, Trocknen", variants: [v("Standard", 20, 30)] },
      { name: "Waschen, Schneiden, Föhnen", variants: [v("Standard", 29, 40)] },
      { name: "Waschen, Schneiden, Trocknen", variants: [v("Standard", 25, 35)] },
    ],
  },
  {
    name: "Besondere Anlässe",
    gender: "WOMEN",
    services: [
      { name: "Hochsteckfrisur", variants: [v("Standard", 45, 60, "FROM")] },
      { name: "Braut (inkl. Probehochstecken & Beratung)", variants: [v("Standard", 185, 120, "FROM")] },
    ],
  },

  // ───────── HERREN (Men) ─────────
  {
    name: "Schneiden & Styling",
    gender: "MEN",
    services: [
      { name: "Schneiden", isPopular: true, variants: [v("Standard", 16, 20)] },
      { name: "Schneiden (Seiten 0 mm mit Übergang)", variants: [v("Standard", 19, 30)] },
      { name: "Waschen, Schneiden, Styling", isPopular: true, variants: [v("Standard", 19, 30)] },
      { name: "Haare Nassrasur", variants: [v("Standard", 19, 30)] },
      { name: "Bart mit Übergang", isPopular: true, variants: [v("Standard", 14, 20)] },
      { name: "Bart Kontur", variants: [v("Standard", 10, 10)] },
      { name: "Bart Rasur", variants: [v("Standard", 14, 20)] },
      { name: "Bart Farbe", variants: [v("Standard", 14, 15)] },
      { name: "Musterrasur (pro Seite)", variants: [v("Standard", 14, 15, "FROM")] },
      { name: "Linienrasur", variants: [v("Standard", 1.5, 10, "FROM")] },
    ],
  },
  {
    name: "Dauerhafte Umformung",
    gender: "MEN",
    services: [{ name: "Dauerwelle", variants: [v("Standard", 40, 60, "FROM")] }],
  },
  {
    name: "Farbe und Tönung",
    gender: "MEN",
    services: [
      { name: "Tönung", variants: [v("Standard", 10, 30, "FROM")] },
      { name: "Farbe", variants: [v("Standard", 31, 45)] },
      { name: "Farbe, Schneiden, Styling", variants: [v("Standard", 36, 60, "FROM")] },
      { name: "Farbe bei längeren Haaren (Aufschlag)", isAddOn: true, variants: [v("Standard", 5, 15)] },
    ],
  },
  {
    name: "Chemische Glättung",
    gender: "MEN",
    services: [{ name: "Glättung", variants: [v("Standard", 27, 45, "FROM")] }],
  },
  {
    name: "Jungs bis 10 Jahre",
    gender: "MEN",
    services: [{ name: "Schneiden", variants: [v("Standard", 13, 20)] }],
  },

  // ───────── Kosmetik & Erweiterungen (female barbers) ─────────
  {
    name: "Make-up / Kosmetik",
    gender: "WOMEN",
    services: [
      { name: "Tages Make-up", variants: [v("Standard", 25, 30, "FROM")] },
      { name: "Abend Make-up", variants: [v("Standard", 45, 45, "FROM")] },
      { name: "Augenbrauen Farbe", isAddOn: true, variants: [v("Standard", 8, 10)] },
      { name: "Wimpern Farbe", isAddOn: true, variants: [v("Standard", 8, 10)] },
      { name: "Zupfen", isAddOn: true, variants: [v("Standard", 8, 10)] },
      { name: "Konturierung", isAddOn: true, variants: [v("Standard", 7, 10)] },
    ],
  },
  {
    name: "Haarverlängerung / Haarverdichtung",
    gender: "WOMEN",
    services: [
      { name: "1 Tape (Paar)", variants: [v("Standard", 20, 15)] },
      { name: "4 Tape (Paar)", variants: [v("Standard", 80, 45)] },
      { name: "20 Tape (Paar)", variants: [v("Standard", 400, 120)] },
      { name: "Ab 20 Tape (Paar)", variants: [v("Auf Anfrage", 0, 120, "ON_REQUEST")] },
    ],
  },
];

// ── placeholder barbers (real names/photos added later via admin) ──
// Placeholder names — real names/photos added later via admin.
const barbers = [
  { name: "Bassam1", gender: "MALE" },
  { name: "Bassam2", gender: "MALE" },
  { name: "Bassam3", gender: "MALE" },
  { name: "Bassam4", gender: "FEMALE" },
  { name: "Bassam5", gender: "FEMALE" },
] as const;

// sample weekly hours: Tue–Fri 09:00–18:00, Sat 09:00–14:00
// weekday uses Luxon convention: 1=Mon … 7=Sun
const baseHours = [
  { weekday: 2, startMinutes: 9 * 60, endMinutes: 18 * 60 },
  { weekday: 3, startMinutes: 9 * 60, endMinutes: 18 * 60 },
  { weekday: 4, startMinutes: 9 * 60, endMinutes: 18 * 60 },
  { weekday: 5, startMinutes: 9 * 60, endMinutes: 18 * 60 },
  { weekday: 6, startMinutes: 9 * 60, endMinutes: 14 * 60 },
];

const sampleReviews = [
  { displayName: "Anna K.", rating: 5, comment: "Super zufrieden, komme gerne wieder!" },
  { displayName: "Mehmet Y.", rating: 5, comment: "Bester Schnitt seit langem." },
  { displayName: "Julia R.", rating: 4, comment: "Sehr freundlich und professionell." },
  { displayName: "Tom B.", rating: 5, comment: "Schnell, sauber, top Beratung." },
  { displayName: "Lena S.", rating: 4, comment: "Tolle Farbe, sehr gerne wieder." },
];

async function main() {
  // Wipe (idempotent re-seed), children before parents.
  await prisma.review.deleteMany();
  await prisma.appointmentItem.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.stylistService.deleteMany();
  await prisma.serviceVariant.deleteMany();
  await prisma.service.deleteMany();
  await prisma.category.deleteMany();
  await prisma.stylist.deleteMany();
  await prisma.customer.deleteMany();

  // Catalog: categories → services → variants.
  for (const [ci, cat] of catalog.entries()) {
    await prisma.category.create({
      data: {
        name: cat.name,
        gender: cat.gender,
        displayOrder: ci,
        services: {
          create: cat.services.map((s, si) => ({
            name: s.name,
            gender: cat.gender,
            isAddOn: s.isAddOn ?? false,
            isPopular: s.isPopular ?? false,
            displayOrder: si,
            variants: {
              create: s.variants.map((vr, vi) => ({ ...vr, displayOrder: vi })),
            },
          })),
        },
      },
    });
  }

  // Barbers + weekly hours.
  const createdStylists = [];
  for (const [bi, b] of barbers.entries()) {
    const st = await prisma.stylist.create({
      data: {
        name: b.name,
        gender: b.gender,
        bio: "Platzhalter – echtes Profil & Foto folgen.",
        displayOrder: bi,
        workingHours: { create: baseHours },
      },
    });
    createdStylists.push(st);
  }

  // Map stylist → services by matching gender (MALE→MEN, FEMALE→WOMEN);
  // UNISEX (if any) goes to everyone.
  const services = await prisma.service.findMany({ select: { id: true, gender: true } });
  const pairs: { stylistId: string; serviceId: string }[] = [];
  for (const st of createdStylists) {
    const want = st.gender === "MALE" ? "MEN" : "WOMEN";
    for (const svc of services) {
      if (svc.gender === want || svc.gender === "UNISEX") {
        pairs.push({ stylistId: st.id, serviceId: svc.id });
      }
    }
  }
  await prisma.stylistService.createMany({ data: pairs });

  // A couple of published reviews per barber so profiles aren't empty.
  const reviews = createdStylists.flatMap((st, i) => [
    { stylistId: st.id, status: "PUBLISHED" as const, ...sampleReviews[i % sampleReviews.length] },
    { stylistId: st.id, status: "PUBLISHED" as const, ...sampleReviews[(i + 2) % sampleReviews.length] },
  ]);
  await prisma.review.createMany({ data: reviews });

  // Settings singleton.
  await prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  // Summary.
  const [categories, svcCount, variants, stylists, links, reviewCount] = await Promise.all([
    prisma.category.count(),
    prisma.service.count(),
    prisma.serviceVariant.count(),
    prisma.stylist.count(),
    prisma.stylistService.count(),
    prisma.review.count(),
  ]);
  console.log(
    `✅ Seeded: ${categories} categories, ${svcCount} services, ${variants} variants, ` +
      `${stylists} barbers, ${links} stylist-service links, ${reviewCount} reviews.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
