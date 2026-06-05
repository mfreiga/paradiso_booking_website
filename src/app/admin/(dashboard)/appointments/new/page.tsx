import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { AdminNewBookingForm } from "@/components/admin-new-booking-form";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage() {
  await requireAdmin();

  const stylists = await prisma.stylist.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      services: {
        include: {
          service: {
            include: { variants: { orderBy: { displayOrder: "asc" } } },
          },
        },
      },
    },
  });

  const barbers = stylists.map((b) => {
    const variants: {
      id: string;
      label: string;
      priceCents: number;
      durationMinutes: number;
    }[] = [];
    for (const ss of b.services) {
      const svc = ss.service;
      if (!svc.isActive) continue;
      for (const v of svc.variants) {
        variants.push({
          id: v.id,
          label: svc.name + (v.label !== "Standard" ? ` – ${v.label}` : ""),
          priceCents: v.priceCents,
          durationMinutes: v.durationMinutes,
        });
      }
    }
    return { id: b.id, name: b.name, variants };
  });

  return (
    <div>
      <Link
        href="/admin/appointments"
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Termine
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Neuer Termin</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Walk-in oder telefonische Buchung manuell eintragen.
      </p>
      <div className="mt-6">
        <AdminNewBookingForm barbers={barbers} />
      </div>
    </div>
  );
}
