import { prisma } from "./prisma";

// Services shown in the homepage price cards, in the order of the
// `home.womenList / menList / studentsList` labels in i18n.ts. Prices are read
// live from the DB so an admin price change shows up on the homepage too.
type Key = readonly ["MEN" | "WOMEN", string, string]; // gender, category, service
const FEATURED = {
  women: [
    ["WOMEN", "Schneiden & Styling", "Waschen, Schneiden, Föhnen"],
    ["WOMEN", "Färben", "Farbe"],
    ["WOMEN", "Strähnen", "Foliensträhnen (Oberkopf)"],
    ["WOMEN", "Strähnen", "Balayage (inkl. Glossing)"],
  ],
  men: [
    ["MEN", "Schneiden & Styling", "Schneiden"],
    ["MEN", "Schneiden & Styling", "Schneiden (Seiten 0 mm mit Übergang)"],
    ["MEN", "Schneiden & Styling", "Waschen, Schneiden, Styling"],
    ["MEN", "Schneiden & Styling", "Bart mit Übergang"],
  ],
  students: [
    ["MEN", "Studentenrabatt", "Schneiden"],
    ["MEN", "Studentenrabatt", "Schneiden (Seiten 0 mm mit Übergang)"],
  ],
} as const satisfies Record<string, readonly Key[]>;

/** Lowest price; `from` when it varies (hair length) or is marked "ab". null = not bookable. */
export type FeaturedPrice = { cents: number; from: boolean } | null;

export async function featuredPrices(): Promise<Record<keyof typeof FEATURED, FeaturedPrice[]>> {
  const keys = Object.values(FEATURED).flat();
  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      category: { isActive: true },
      OR: keys.map(([gender, category, name]) => ({ gender, name, category: { name: category } })),
    },
    select: {
      name: true,
      gender: true,
      category: { select: { name: true } },
      variants: { select: { priceCents: true, priceType: true } },
    },
  });

  const price = ([gender, category, name]: Key): FeaturedPrice => {
    const s = services.find((x) => x.gender === gender && x.name === name && x.category.name === category);
    if (!s || s.variants.length === 0) return null;
    return {
      cents: Math.min(...s.variants.map((v) => v.priceCents)),
      from: s.variants.length > 1 || s.variants.some((v) => v.priceType !== "FIXED"),
    };
  };
  return {
    women: FEATURED.women.map(price),
    men: FEATURED.men.map(price),
    students: FEATURED.students.map(price),
  };
}
