import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { formatEur } from "@/lib/format";
import { tName } from "@/lib/service-i18n";
import { createCategory, createService, deleteCategory, deleteService, saveCategory, saveService } from "./actions";

export const dynamic = "force-dynamic";

const genderLabel: Record<string, string> = { WOMEN: "Damen", MEN: "Herren", UNISEX: "Für alle" };
const genderRank: Record<string, number> = { WOMEN: 0, MEN: 1, UNISEX: 2 };
const messages: Record<string, [string, "ok" | "err"]> = {
  saved: ["Gespeichert.", "ok"],
  deleted: ["Gelöscht.", "ok"],
  catCreated: ["Kategorie angelegt.", "ok"],
  svcCreated: ["Leistung angelegt.", "ok"],
  svcDeactivated: ["Die Leistung wurde schon gebucht und ist deshalb jetzt nur deaktiviert statt gelöscht.", "ok"],
  variantInUse: ["Gespeichert. Varianten, die schon gebucht wurden, bleiben erhalten.", "ok"],
  catInvalid: ["Bitte einen Namen für die Kategorie eingeben.", "err"],
  catNotEmpty: ["Die Kategorie enthält noch Leistungen. Bitte zuerst die Leistungen löschen oder verschieben.", "err"],
  svcInvalid: ["Bitte Name, Preis und Dauer (mind. 5 Minuten) angeben.", "err"],
  svcNoVariant: ["Eine Leistung braucht mindestens eine Preisstufe.", "err"],
};

const input = "rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-orange-500";
const small = "rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100";

function PriceTypeSelect({ name, value = "FIXED" }: { name: string; value?: string }) {
  return (
    <select name={name} defaultValue={value} className={input}>
      <option value="FIXED">fester Preis</option>
      <option value="FROM">ab-Preis</option>
      <option value="ON_REQUEST">auf Anfrage</option>
    </select>
  );
}

export default async function ServicesAdminPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const msg = sp.msg ? messages[sp.msg] : undefined;

  const categories = await prisma.category.findMany({
    include: {
      services: {
        orderBy: { displayOrder: "asc" },
        include: { variants: { orderBy: { displayOrder: "asc" } }, _count: { select: { stylists: true } } },
      },
    },
  });
  categories.sort((a, b) => (genderRank[a.gender] ?? 9) - (genderRank[b.gender] ?? 9) || a.displayOrder - b.displayOrder);
  const genders = [...new Set(categories.map((c) => c.gender))];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Leistungen</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tippe eine Leistung an, um Name, Preise und Dauer zu ändern. Die Dauer bestimmt, wie lange ein Termin online blockiert wird.
        Mit <strong>★ Beliebt</strong> markierte Leistungen stehen auf der Startseite und oben in der Buchung. Wer was anbietet,
        stellst du bei den{" "}
        <Link href="/admin/barbers" className="underline">
          Friseuren
        </Link>{" "}
        ein.
      </p>
      {msg && <p className={`mt-4 rounded-lg p-3 text-sm ${msg[1] === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg[0]}</p>}

      <details className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">+ Neue Kategorie</summary>
        <form action={createCategory} className="flex flex-wrap items-end gap-3 border-t border-neutral-100 px-4 py-3 text-sm">
          <label>
            Name
            <input name="name" required maxLength={80} className={`${input} mt-1 block`} />
          </label>
          <label>
            Englisch (optional)
            <input name="nameEn" maxLength={80} className={`${input} mt-1 block`} />
          </label>
          <label>
            Bereich
            <select name="gender" className={`${input} mt-1 block`}>
              <option value="MEN">Herren</option>
              <option value="WOMEN">Damen</option>
              <option value="UNISEX">Für alle</option>
            </select>
          </label>
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700">Anlegen</button>
        </form>
      </details>

      {genders.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-800">{genderLabel[g] ?? g}</h2>
          <div className="mt-3 space-y-4">
            {categories
              .filter((c) => c.gender === g)
              .map((cat) => (
                <div key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-20 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <details className="border-b border-neutral-100 bg-neutral-50">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700">
                      <span className={cat.isActive ? "" : "text-neutral-400 line-through"}>{cat.name}</span>
                      <span className="font-normal text-neutral-400">· {tName(cat.name, "en", cat.nameEn)}</span>
                      <span className="ml-auto text-xs font-normal text-neutral-400">Kategorie bearbeiten</span>
                    </summary>
                    <div className="flex flex-wrap items-end gap-3 px-4 pb-3 text-sm">
                      <form action={saveCategory} className="flex flex-wrap items-end gap-3">
                        <input type="hidden" name="id" value={cat.id} />
                        <label>
                          Name
                          <input name="name" defaultValue={cat.name} required maxLength={80} className={`${input} mt-1 block`} />
                        </label>
                        <label>
                          Englisch
                          <input name="nameEn" defaultValue={cat.nameEn ?? ""} placeholder={tName(cat.name, "en")} maxLength={80} className={`${input} mt-1 block`} />
                        </label>
                        <label className="flex items-center gap-2 pb-2">
                          <input type="checkbox" name="isActive" defaultChecked={cat.isActive} className="h-4 w-4 accent-orange-500" /> sichtbar
                        </label>
                        <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700">Speichern</button>
                      </form>
                      {cat.services.length === 0 && (
                        <form action={deleteCategory}>
                          <input type="hidden" name="id" value={cat.id} />
                          <button className="rounded-lg border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50">Kategorie löschen</button>
                        </form>
                      )}
                    </div>
                  </details>

                  <ul className="divide-y divide-neutral-100">
                    {cat.services.map((s) => {
                      const prices = s.variants.map((v) => v.priceCents);
                      const durs = s.variants.map((v) => v.durationMinutes);
                      const range = (xs: number[], f: (n: number) => string) =>
                        xs.length === 0 ? "–" : Math.min(...xs) === Math.max(...xs) ? f(xs[0]) : `${f(Math.min(...xs))}–${f(Math.max(...xs))}`;
                      return (
                        <li key={s.id} id={`svc-${s.id}`} className="scroll-mt-20">
                          <details>
                            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-neutral-50">
                              <span className={s.isActive ? "font-medium" : "font-medium text-neutral-400 line-through"}>{s.name}</span>
                              {s.isPopular && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">★ Beliebt</span>}
                              {s.isAddOn && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">Zusatz</span>}
                              {s._count.stylists === 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">niemand bietet sie an</span>}
                              <span className="ml-auto text-neutral-500">
                                {range(prices, (c) => formatEur(c))} · {range(durs, (m) => `${m}`)} Min
                              </span>
                            </summary>
                            <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">
                              <form action={saveService} className="space-y-3 text-sm">
                                <input type="hidden" name="id" value={s.id} />
                                <div className="flex flex-wrap gap-3">
                                  <label>
                                    Name
                                    <input name="name" defaultValue={s.name} required maxLength={80} className={`${input} mt-1 block w-64`} />
                                  </label>
                                  <label>
                                    Englisch
                                    <input name="nameEn" defaultValue={s.nameEn ?? ""} placeholder={tName(s.name, "en")} maxLength={80} className={`${input} mt-1 block w-64`} />
                                  </label>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                  <label className="flex items-center gap-2">
                                    <input type="checkbox" name="isActive" defaultChecked={s.isActive} className="h-4 w-4 accent-orange-500" /> buchbar
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <input type="checkbox" name="isPopular" defaultChecked={s.isPopular} className="h-4 w-4 accent-orange-500" /> ★ Beliebt
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <input type="checkbox" name="isAddOn" defaultChecked={s.isAddOn} className="h-4 w-4 accent-orange-500" /> Zusatz (nur zusammen mit anderem)
                                  </label>
                                </div>
                                <div className="space-y-2">
                                  <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">Preisstufen</div>
                                  {s.variants.map((v) => (
                                    <div key={v.id} className="flex flex-wrap items-center gap-2">
                                      <input name={`v_${v.id}_label`} defaultValue={v.label} maxLength={40} className={`${input} w-28`} aria-label="Bezeichnung" />
                                      <input name={`v_${v.id}_price`} type="number" step="0.5" min="0" defaultValue={(v.priceCents / 100).toString()} className={`${input} w-24`} aria-label="Preis in Euro" />
                                      <span className="text-neutral-400">€</span>
                                      <input name={`v_${v.id}_duration`} type="number" step="5" min="5" defaultValue={v.durationMinutes} className={`${input} w-20`} aria-label="Dauer in Minuten" />
                                      <span className="text-neutral-400">Min</span>
                                      <PriceTypeSelect name={`v_${v.id}_type`} value={v.priceType} />
                                      {s.variants.length > 1 && (
                                        <label className="flex items-center gap-1 text-xs text-red-700">
                                          <input type="checkbox" name={`v_${v.id}_delete`} className="h-3.5 w-3.5" /> entfernen
                                        </label>
                                      )}
                                    </div>
                                  ))}
                                  <div className="flex flex-wrap items-center gap-2 text-neutral-500">
                                    <input name="new_label" placeholder="+ neue Stufe, z. B. Lang" maxLength={40} className={`${input} w-28`} />
                                    <input name="new_price" type="number" step="0.5" min="0" placeholder="Preis" className={`${input} w-24`} />
                                    <span className="text-neutral-400">€</span>
                                    <input name="new_duration" type="number" step="5" min="5" placeholder="Dauer" className={`${input} w-20`} />
                                    <span className="text-neutral-400">Min</span>
                                    <PriceTypeSelect name="new_type" />
                                  </div>
                                  <p className="text-xs text-neutral-400">
                                    Für die Haarlänge in der Buchung die Stufen „Kurz“, „Mittel“ und „Lang“ nennen.
                                  </p>
                                </div>
                                <button className="rounded-lg bg-neutral-900 px-4 py-1.5 text-white hover:bg-neutral-700">Speichern</button>
                              </form>
                              <form action={deleteService} className="mt-3">
                                <input type="hidden" name="id" value={s.id} />
                                <button className="text-xs text-red-700 underline">Leistung löschen</button>
                              </form>
                            </div>
                          </details>
                        </li>
                      );
                    })}
                    <li>
                      <details>
                        <summary className="cursor-pointer px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50">+ Leistung hinzufügen</summary>
                        <form action={createService} className="flex flex-wrap items-end gap-3 border-t border-neutral-100 bg-neutral-50/60 px-4 py-3 text-sm">
                          <input type="hidden" name="categoryId" value={cat.id} />
                          <label>
                            Name
                            <input name="name" required maxLength={80} className={`${input} mt-1 block w-56`} />
                          </label>
                          <label>
                            Englisch (optional)
                            <input name="nameEn" maxLength={80} className={`${input} mt-1 block w-56`} />
                          </label>
                          <label>
                            Preis €
                            <input name="price" type="number" step="0.5" min="0" required className={`${input} mt-1 block w-24`} />
                          </label>
                          <label>
                            Dauer Min
                            <input name="duration" type="number" step="5" min="5" required className={`${input} mt-1 block w-24`} />
                          </label>
                          <label>
                            Preisart
                            <span className="mt-1 block">
                              <PriceTypeSelect name="priceType" />
                            </span>
                          </label>
                          <label className="flex items-center gap-2 pb-2">
                            <input type="checkbox" name="isAddOn" className="h-4 w-4 accent-orange-500" /> Zusatz
                          </label>
                          <label className="flex items-center gap-2 pb-2">
                            <input type="checkbox" name="assignAll" defaultChecked className="h-4 w-4 accent-orange-500" /> allen passenden Friseuren geben
                          </label>
                          <button className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600">Anlegen</button>
                        </form>
                      </details>
                    </li>
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
