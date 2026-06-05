import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { toggleServiceField, updateVariant } from "./actions";

const genderLabel: Record<string, string> = {
  WOMEN: "Damen",
  MEN: "Herren",
  UNISEX: "Unisex",
};
const genderRank: Record<string, number> = { WOMEN: 0, MEN: 1, UNISEX: 2 };

export default async function ServicesAdminPage() {
  await requireAdmin();

  const categories = await prisma.category.findMany({
    include: {
      services: {
        orderBy: { displayOrder: "asc" },
        include: { variants: { orderBy: { displayOrder: "asc" } } },
      },
    },
  });
  categories.sort(
    (a, b) =>
      (genderRank[a.gender] ?? 9) - (genderRank[b.gender] ?? 9) ||
      a.displayOrder - b.displayOrder,
  );
  const genders = [...new Set(categories.map((c) => c.gender))];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Leistungen</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Preise, Dauer und Sichtbarkeit verwalten. Die <strong>Dauer</strong>{" "}
        bestimmt, welche Terminzeiten Kund&shy;innen angeboten werden.
      </p>

      {genders.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-800">
            {genderLabel[g] ?? g}
          </h2>
          <div className="mt-3 space-y-5">
            {categories
              .filter((c) => c.gender === g)
              .map((cat) => (
                <div
                  key={cat.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700">
                    {cat.name}
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {cat.services.map((s) => (
                      <li key={s.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                s.isActive
                                  ? "font-medium text-neutral-900"
                                  : "font-medium text-neutral-400 line-through"
                              }
                            >
                              {s.name}
                            </span>
                            {s.isAddOn && (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                                Zusatz
                              </span>
                            )}
                            {s.isPopular && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                Beliebt
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <FieldToggle
                              id={s.id}
                              field="isPopular"
                              next={!s.isPopular}
                              label={s.isPopular ? "★ entfernen" : "★ Beliebt"}
                            />
                            <FieldToggle
                              id={s.id}
                              field="isActive"
                              next={!s.isActive}
                              label={s.isActive ? "Deaktivieren" : "Aktivieren"}
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex flex-col gap-1.5">
                          {s.variants.map((v) => (
                            <form
                              key={v.id}
                              action={updateVariant}
                              className="flex flex-wrap items-center gap-2 text-sm"
                            >
                              <input type="hidden" name="id" value={v.id} />
                              <span className="w-32 shrink-0 text-neutral-500">
                                {v.label}
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  name="price"
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  defaultValue={(v.priceCents / 100).toString()}
                                  disabled={v.priceType === "ON_REQUEST"}
                                  className="w-24 rounded border border-neutral-300 px-2 py-1 disabled:bg-neutral-100"
                                />
                                <span className="w-16 text-xs text-neutral-400">
                                  {v.priceType === "FROM"
                                    ? "€ (ab)"
                                    : v.priceType === "ON_REQUEST"
                                      ? "Anfrage"
                                      : "€"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <input
                                  name="duration"
                                  type="number"
                                  step="5"
                                  min="0"
                                  defaultValue={v.durationMinutes}
                                  className="w-20 rounded border border-neutral-300 px-2 py-1"
                                />
                                <span className="text-xs text-neutral-400">Min</span>
                              </div>
                              <button
                                type="submit"
                                className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700"
                              >
                                Speichern
                              </button>
                            </form>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldToggle({
  id,
  field,
  next,
  label,
}: {
  id: string;
  field: string;
  next: boolean;
  label: string;
}) {
  return (
    <form action={toggleServiceField}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="next" value={String(next)} />
      <button
        type="submit"
        className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
      >
        {label}
      </button>
    </form>
  );
}
