import { prisma } from "@/lib/prisma";
import { BookingWizard } from "@/components/booking-wizard";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const [categories, stylists, setting] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
          include: { variants: { orderBy: { displayOrder: "asc" } } },
        },
      },
    }),
    prisma.stylist.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        services: { select: { serviceId: true } },
        workingHours: { select: { weekday: true } },
        reviews: {
          where: { status: "PUBLISHED" },
          select: { displayName: true, rating: true, comment: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);

  const wizardCategories = categories
    .filter((c) => c.services.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      gender: c.gender,
      services: c.services.map((s) => ({
        id: s.id,
        name: s.name,
        isAddOn: s.isAddOn,
        isPopular: s.isPopular,
        variants: s.variants.map((v) => ({
          id: v.id,
          label: v.label,
          priceCents: v.priceCents,
          priceType: v.priceType,
          durationMinutes: v.durationMinutes,
        })),
      })),
    }));

  const barbers = stylists.map((b) => {
    const count = b.reviews.length;
    const avg =
      count > 0 ? b.reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
    return {
      id: b.id,
      name: b.name,
      gender: b.gender,
      bio: b.bio,
      photoUrl: b.photoUrl,
      serviceIds: b.services.map((x) => x.serviceId),
      workingWeekdays: [...new Set(b.workingHours.map((w) => w.weekday))],
      avgRating: Math.round(avg * 10) / 10,
      reviewCount: count,
      reviews: b.reviews
        .filter((r) => r.comment)
        .slice(0, 3)
        .map((r) => ({ displayName: r.displayName, rating: r.rating, comment: r.comment })),
    };
  });

  const locale = await getLocale();

  return (
    <BookingWizard
      categories={wizardCategories}
      barbers={barbers}
      bookingWindowDays={setting?.bookingWindowDays ?? 60}
      locale={locale}
    />
  );
}
