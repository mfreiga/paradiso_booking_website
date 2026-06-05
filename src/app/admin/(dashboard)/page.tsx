import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const [services, barbers, upcoming, pendingReviews] = await Promise.all([
    prisma.service.count({ where: { isActive: true } }),
    prisma.stylist.count({ where: { isActive: true } }),
    prisma.appointment.count({
      where: { startAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    prisma.review.count({ where: { status: "PENDING" } }),
  ]);

  const cards = [
    { label: "Aktive Leistungen", value: services, href: "/admin/services" },
    { label: "Friseure", value: barbers, href: "/admin/barbers" },
    { label: "Kommende Termine", value: upcoming, href: "/admin/appointments" },
    { label: "Bewertungen offen", value: pendingReviews, href: "/admin/reviews" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Übersicht</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Willkommen im Paradiso-Adminbereich.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow"
          >
            <div className="text-3xl font-semibold">{c.value}</div>
            <div className="mt-1 text-sm text-neutral-500">{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
