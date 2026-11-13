import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isOwner, requireStaff } from "@/lib/auth-guard";
import { AdminNewBookingForm } from "@/components/admin-new-booking-form";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; barber?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const stylists = await prisma.stylist.findMany({
    omit: { photoData: true },
    // Barbers only book into their own calendar.
    where: { isActive: true, ...(isOwner(staff) ? {} : { id: staff.stylistId ?? "__none__" }) },
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
      <h1 className="mt-2 text-2xl font-semibold">Termin eintragen</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Für Anrufe und Kund:innen im Laden. Stammkund:innen findest du über Telefonnummer oder Namen.
      </p>
      <div className="mt-6">
        {barbers.length === 0 ? (
          <p className="text-sm text-neutral-500">Dein Zugang ist noch keinem Friseur-Kalender zugeordnet. Bitte beim Inhaber melden.</p>
        ) : (
          <AdminNewBookingForm
            barbers={barbers}
            canPickAny={isOwner(staff) && barbers.length > 1}
            initialBarber={sp.barber && barbers.some((b) => b.id === sp.barber) ? sp.barber : undefined}
            initialDate={sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined}
          />
        )}
      </div>
    </div>
  );
}
