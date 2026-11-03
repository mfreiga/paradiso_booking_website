import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { BarberPhotoUpload } from "@/components/barber-photo-upload";
import { deleteBarber, removeBarberPhoto, saveBarber, toggleBarberActive } from "../actions";
import { BarberProfileFields, WorkingHoursFields } from "../barber-fields";

export const dynamic = "force-dynamic";

const genderLabel: Record<string, string> = { MEN: "Herren", WOMEN: "Damen", UNISEX: "Alle" };

export default async function EditBarberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; error?: string; warn?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const [barber, categories, bookings, upcoming] = await Promise.all([
    prisma.stylist.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        bio: true,
        gender: true,
        isActive: true,
        photoUrl: true,
        workingHours: true,
        services: { select: { serviceId: true } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ gender: "asc" }, { displayOrder: "asc" }],
      include: { services: { where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.appointment.count({ where: { stylistId: id } }),
    prisma.appointment.findMany({
      where: { stylistId: id, status: { in: ["PENDING", "CONFIRMED"] }, startAt: { gt: new Date() } },
      orderBy: { startAt: "asc" },
      select: { id: true, startAt: true, customerName: true },
    }),
  ]);
  if (!barber) notFound();

  const offered = new Set(barber.services.map((s) => s.serviceId));
  // Own area first (men's categories for a barber, women's for a stylist).
  const own = barber.gender === "MALE" ? "MEN" : "WOMEN";
  const sorted = [...categories]
    .filter((c) => c.services.length > 0)
    .sort((a, b) => Number(b.gender === own) - Number(a.gender === own));

  return (
    <div className="max-w-3xl">
      <Link href="/admin/barbers" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Friseure
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{barber.name}</h1>
        <form action={toggleBarberActive}>
          <input type="hidden" name="id" value={barber.id} />
          <input type="hidden" name="next" value={String(!barber.isActive)} />
          <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
            {barber.isActive ? "Deaktivieren (nicht mehr buchbar)" : "Aktivieren"}
          </button>
        </form>
      </div>

      {sp.warn && upcoming.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            {barber.name} hat noch {upcoming.length} {upcoming.length === 1 ? "kommenden Termin" : "kommende Termine"}.
          </p>
          <p className="mt-1">
            Nach dem Deaktivieren kann niemand mehr neu bei {barber.name} buchen, die bestehenden Termine bleiben aber.
            Verschieben oder absagen kannst du sie unter{" "}
            <Link href={`/admin/appointments?barber=${barber.id}`} className="underline">
              Termine
            </Link>
            .
          </p>
          <ul className="mt-2 list-disc pl-5">
            {upcoming.slice(0, 8).map((a) => (
              <li key={a.id}>
                {DateTime.fromJSDate(a.startAt).setZone("Europe/Berlin").setLocale("de").toFormat("ccc dd.MM., HH:mm")} · {a.customerName}
              </li>
            ))}
          </ul>
          <form action={toggleBarberActive} className="mt-3">
            <input type="hidden" name="id" value={barber.id} />
            <input type="hidden" name="next" value="false" />
            <input type="hidden" name="confirm" value="1" />
            <button className="rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700">Trotzdem deaktivieren</button>
          </form>
        </div>
      )}
      {sp.created && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Angelegt. Jetzt noch ein Foto hochladen und die Leistungen prüfen.
        </p>
      )}
      {sp.saved && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">Gespeichert.</p>}
      {sp.error === "name" && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Bitte einen Namen eingeben.</p>}
      {sp.error === "inuse" && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Löschen geht nicht, weil es schon Termine gibt. Bitte stattdessen deaktivieren.
        </p>
      )}

      {/* Photo */}
      <section className="mt-6 flex flex-wrap items-center gap-5 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-orange-100">
          {barber.photoUrl ? (
            <Image src={barber.photoUrl} alt={barber.name} fill unoptimized sizes="96px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-orange-600">
              {barber.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-neutral-700">Foto</div>
          <p className="text-xs text-neutral-400">Am besten ein Porträt im Hochformat. Wird automatisch verkleinert.</p>
          <div className="flex flex-wrap items-center gap-2">
            <BarberPhotoUpload stylistId={barber.id} hasPhoto={!!barber.photoUrl} />
            {barber.photoUrl && (
              <form action={removeBarberPhoto}>
                <input type="hidden" name="id" value={barber.id} />
                <button className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                  Entfernen
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <form action={saveBarber} className="mt-6 space-y-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <input type="hidden" name="id" value={barber.id} />
        <input type="hidden" name="services_present" value="1" />
        <BarberProfileFields name={barber.name} bio={barber.bio} gender={barber.gender} />
        <WorkingHoursFields hours={barber.workingHours} />

        <fieldset>
          <legend className="text-sm font-medium text-neutral-700">Leistungen ({offered.size})</legend>
          <p className="text-xs text-neutral-400">Nur angehakte Leistungen können bei {barber.name} gebucht werden.</p>
          <div className="mt-2 space-y-2">
            {sorted.map((c) => {
              const n = c.services.filter((s) => offered.has(s.id)).length;
              return (
                <details key={c.id} open={c.gender === own} className="rounded-lg border border-neutral-200">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                    {c.name}{" "}
                    <span className="font-normal text-neutral-400">
                      · {genderLabel[c.gender]} · {n}/{c.services.length}
                    </span>
                  </summary>
                  <div className="grid gap-1 border-t border-neutral-100 px-3 py-2 sm:grid-cols-2">
                    {c.services.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-0.5 text-sm">
                        <input type="checkbox" name="service" value={s.id} defaultChecked={offered.has(s.id)} className="h-4 w-4 accent-orange-500" />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </fieldset>

        <button className="w-full rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600 sm:w-auto">
          Speichern
        </button>
      </form>

      {bookings === 0 && (
        <form action={deleteBarber} className="mt-6">
          <input type="hidden" name="id" value={barber.id} />
          <button className="text-sm text-red-700 underline hover:text-red-900">Friseur:in löschen</button>
          <span className="ml-2 text-xs text-neutral-400">(nur möglich, solange es keine Termine gibt)</span>
        </form>
      )}
    </div>
  );
}
