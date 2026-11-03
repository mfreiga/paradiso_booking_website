import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { moveBarber, toggleBarberActive } from "./actions";

export const dynamic = "force-dynamic";

const dayShort = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function BarbersAdminPage() {
  await requireAdmin();
  const barbers = await prisma.stylist.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      gender: true,
      isActive: true,
      photoUrl: true,
      workingHours: { orderBy: { weekday: "asc" } },
      _count: { select: { services: true } },
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Friseure</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Wer hier aktiv ist, erscheint automatisch auf der Website und in der Online-Buchung.
          </p>
        </div>
        <Link
          href="/admin/barbers/new"
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          + Neue:r Friseur:in
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {barbers.map((b, i) => (
          <div
            key={b.id}
            className={`flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 ${b.isActive ? "" : "opacity-60"}`}
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-orange-100">
              {b.photoUrl ? (
                <Image src={b.photoUrl} alt={b.name} fill unoptimized sizes="56px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-orange-600">
                  {b.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/barbers/${b.id}`} className="text-lg font-medium hover:underline">
                  {b.name}
                </Link>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  {b.gender === "MALE" ? "Herren" : "Damen"}
                </span>
                {!b.isActive && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">inaktiv</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                {b._count.services} Leistungen ·{" "}
                {b.workingHours.length === 0
                  ? "keine Arbeitszeiten"
                  : b.workingHours.map((w) => `${dayShort[w.weekday]} ${hhmm(w.startMinutes)}–${hhmm(w.endMinutes)}`).join(", ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <form action={moveBarber}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="dir" value="up" />
                <button disabled={i === 0} aria-label="Nach oben" className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-30">
                  ↑
                </button>
              </form>
              <form action={moveBarber}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="dir" value="down" />
                <button disabled={i === barbers.length - 1} aria-label="Nach unten" className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-30">
                  ↓
                </button>
              </form>
              <form action={toggleBarberActive}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="next" value={String(!b.isActive)} />
                <button className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
                  {b.isActive ? "Deaktivieren" : "Aktivieren"}
                </button>
              </form>
              <Link
                href={`/admin/barbers/${b.id}`}
                className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700"
              >
                Bearbeiten
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
