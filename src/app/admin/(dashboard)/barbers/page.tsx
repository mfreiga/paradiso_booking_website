import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { saveBarber, toggleBarberActive } from "./actions";

const dayLabels = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]; // 1..7 (Luxon)
const genderLabel: Record<string, string> = { MALE: "Herren", FEMALE: "Damen" };
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function BarbersAdminPage() {
  await requireAdmin();

  const barbers = await prisma.stylist.findMany({
    orderBy: { displayOrder: "asc" },
    include: { workingHours: true, _count: { select: { services: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Friseure</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Name, Bio, Arbeitszeiten und Status verwalten. Die Arbeitszeiten bestimmen
        die buchbaren Termine. (Platzhalter-Namen – später anpassbar.)
      </p>

      <div className="mt-6 space-y-5">
        {barbers.map((b) => {
          const byDay = new Map(b.workingHours.map((w) => [w.weekday, w]));
          return (
            <div
              key={b.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium">{b.name}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    {genderLabel[b.gender] ?? b.gender}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {b._count.services} Leistungen
                  </span>
                  {!b.isActive && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      inaktiv
                    </span>
                  )}
                </div>
                <form action={toggleBarberActive}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="next" value={String(!b.isActive)} />
                  <button className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
                    {b.isActive ? "Deaktivieren" : "Aktivieren"}
                  </button>
                </form>
              </div>

              <form action={saveBarber} className="mt-4 space-y-4">
                <input type="hidden" name="id" value={b.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-neutral-600">Name</span>
                    <input
                      name="name"
                      defaultValue={b.name}
                      className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-neutral-600">Bio</span>
                    <input
                      name="bio"
                      defaultValue={b.bio ?? ""}
                      placeholder="Kurze Beschreibung"
                      className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-1 text-sm font-medium text-neutral-700">
                    Arbeitszeiten
                  </div>
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
                      const w = byDay.get(wd);
                      return (
                        <div key={wd} className="flex items-center gap-2 text-sm">
                          <label className="flex w-20 items-center gap-2">
                            <input
                              type="checkbox"
                              name={`day_${wd}_on`}
                              defaultChecked={!!w}
                            />
                            <span>{dayLabels[wd]}</span>
                          </label>
                          <input
                            type="time"
                            name={`day_${wd}_start`}
                            defaultValue={w ? hhmm(w.startMinutes) : "09:00"}
                            className="rounded border border-neutral-300 px-2 py-1"
                          />
                          <span className="text-neutral-400">–</span>
                          <input
                            type="time"
                            name={`day_${wd}_end`}
                            defaultValue={w ? hhmm(w.endMinutes) : "18:00"}
                            className="rounded border border-neutral-300 px-2 py-1"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                >
                  Speichern
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
