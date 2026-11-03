import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { saveBarber } from "../actions";
import { BarberProfileFields, DEFAULT_HOURS, WorkingHoursFields } from "../barber-fields";

export default async function NewBarberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  return (
    <div className="max-w-2xl">
      <Link href="/admin/barbers" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Friseure
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Neue:r Friseur:in</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Startet mit allen Leistungen des gewählten Bereichs. Foto und Leistungen kannst du im nächsten
        Schritt anpassen.
      </p>
      {sp.error === "name" && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Bitte einen Namen eingeben.</p>}

      <form action={saveBarber} className="mt-6 space-y-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <BarberProfileFields />
        <WorkingHoursFields hours={DEFAULT_HOURS} />
        <button className="w-full rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600 sm:w-auto">
          Anlegen & weiter
        </button>
      </form>
    </div>
  );
}
