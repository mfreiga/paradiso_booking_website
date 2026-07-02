"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getSlots, createBooking } from "@/app/book/actions";
import { dict, dateLocale, type Locale } from "@/lib/i18n";
import { LanguageSwitch } from "./language-switch";

// ── types (match /book/page.tsx) ─────────────────────────────
type Variant = {
  id: string;
  label: string;
  priceCents: number;
  priceType: string;
  durationMinutes: number;
};
type Service = {
  id: string;
  name: string;
  isAddOn: boolean;
  isPopular: boolean;
  variants: Variant[];
};
type Category = { id: string; name: string; gender: string; services: Service[] };
type Barber = {
  id: string;
  name: string;
  gender: string;
  bio: string | null;
  photoUrl: string | null;
  serviceIds: string[];
  workingWeekdays: number[];
  avgRating: number;
  reviewCount: number;
  reviews: { displayName: string; rating: number; comment: string | null }[];
};
type Props = {
  categories: Category[];
  barbers: Barber[];
  bookingWindowDays: number;
  locale: Locale;
};

type Length = "Kurz" | "Mittel" | "Lang";
type Step = "services" | "length" | "barber" | "time" | "details" | "done";

// ── helpers ──────────────────────────────────────────────────
const euroFmt = (cents: number, loc: string) =>
  new Intl.NumberFormat(loc, { style: "currency", currency: "EUR" }).format(cents / 100);
const fmtTimeFmt = (iso: string, loc: string) =>
  new Intl.DateTimeFormat(loc, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(iso));

const isTiered = (s: Service) => s.variants.length > 1;

function pickVariant(s: Service, length: Length): Variant {
  if (s.variants.length === 1) return s.variants[0];
  const order: Length[] = ["Kurz", "Mittel", "Lang"];
  const find = (l: string) => s.variants.find((v) => v.label.startsWith(l));
  const exact = find(length);
  if (exact) return exact;
  const idx = order.indexOf(length);
  for (let d = 1; d < order.length; d++) {
    const hi = order[idx + d] && find(order[idx + d]);
    const lo = order[idx - d] && find(order[idx - d]);
    if (hi) return hi;
    if (lo) return lo;
  }
  return s.variants[0];
}

function isoWeekday(d: Date) {
  return ((d.getDay() + 6) % 7) + 1; // 1=Mon … 7=Sun
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400" aria-label={`${value} von 5`}>
      {"★".repeat(Math.round(value))}
      <span className="text-neutral-600">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

// ── component ────────────────────────────────────────────────
export function BookingWizard({ categories, barbers, bookingWindowDays, locale }: Props) {
  const t = dict[locale].book;
  const loc = dateLocale[locale];
  const WD_SHORT = dict[locale].weekdaysShort;
  const euro = (cents: number) => euroFmt(cents, loc);
  const fmtTime = (iso: string) => fmtTimeFmt(iso, loc);
  const fmtDur = (m: number) =>
    m < 60
      ? `${m} ${t.min}`
      : m % 60
        ? `${Math.floor(m / 60)} ${t.hours} ${m % 60} ${t.min}`
        : `${Math.floor(m / 60)} ${t.hours}`;

  const [step, setStep] = useState<Step>("services");
  const [gender, setGender] = useState<"MEN" | "WOMEN">("MEN");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [length, setLength] = useState<Length | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allServices = categories.flatMap((c) => c.services);
  const selectedServices = allServices.filter((s) => selected.has(s.id));
  const needsLength = selectedServices.some(isTiered);
  const effLength: Length = length ?? "Mittel";
  const items = selectedServices.map((s) => ({ service: s, variant: pickVariant(s, effLength) }));
  const totalDuration = items.reduce((n, it) => n + it.variant.durationMinutes, 0);
  const totalPrice = items.reduce((n, it) => n + it.variant.priceCents, 0);
  const variantIds = items.map((it) => it.variant.id);
  const showFrom = items.some((it) => ["FROM", "ON_REQUEST"].includes(it.variant.priceType)) || (needsLength && !length);
  const qualifiedBarbers = barbers.filter((b) =>
    selectedServices.every((s) => b.serviceIds.includes(s.id)),
  );
  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const genderCats = categories.filter((c) => c.gender === gender);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function loadSlots(b: string, d: string) {
    setLoadingSlots(true);
    setSlots([]);
    setSlot(null);
    startTransition(async () => {
      const res = await getSlots(b, d, variantIds);
      setSlots(res);
      setLoadingSlots(false);
    });
  }

  function upcomingDays(b: Barber): { date: string; label: string }[] {
    const out: { date: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < bookingWindowDays && out.length < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (b.workingWeekdays.includes(isoWeekday(d))) {
        out.push({ date: ymd(d), label: `${WD_SHORT[isoWeekday(d)]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}` });
      }
    }
    return out;
  }

  function submit() {
    if (!barberId || !slot) return;
    setError(null);
    startTransition(async () => {
      const res = await createBooking({
        stylistId: barberId,
        variantIds,
        startAt: slot,
        name: form.name,
        email: form.email,
        phone: form.phone,
        note: form.note,
      });
      if (res.ok) {
        setManageToken(res.manageToken);
        setStep("done");
      } else {
        setError(res.error);
        if (res.error.includes("verfügbar") || res.error.includes("vergeben")) {
          setStep("time");
          if (barberId && date) loadSlots(barberId, date);
        }
      }
    });
  }

  // ── shells ─────────────────────────────────────────────────
  const Header = ({ title, back }: { title: string; back?: () => void }) => (
    <div className="mb-4 flex items-center gap-3">
      {back && (
        <button onClick={back} className="text-sm text-neutral-400 hover:text-white">
          {t.back}
        </button>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );

  const SummaryBar = ({ cta, onClick, disabled }: { cta: string; onClick: () => void; disabled?: boolean }) => (
    <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t border-white/10 bg-neutral-950/90 py-3 backdrop-blur">
      <div className="text-sm">
        <div className="font-medium">
          {selected.size} {selected.size === 1 ? t.service : t.services} ·{" "}
          {showFrom ? `${t.from} ` : ""}
          {euro(totalPrice)}
        </div>
        <div className="text-neutral-400">≈ {fmtDur(totalDuration)}</div>
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        className="rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {cta}
      </button>
    </div>
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-2 flex justify-end">
        <LanguageSwitch locale={locale} />
      </div>
      <div className="mb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-orange-400">{t.kicker}</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          <Link href="/" className="transition hover:text-orange-400">Paradiso</Link> · {t.title}
        </h1>
      </div>

      {/* STEP: services */}
      {step === "services" && (
        <div>
          <div className="mb-5 flex rounded-full bg-white/10 p-1">
            {(["MEN", "WOMEN"] as const).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGender(g);
                  setSelected(new Set());
                }}
                className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-medium outline-none transition ${gender === g ? "bg-orange-500 text-white shadow-sm" : "text-neutral-400 hover:text-white"}`}
              >
                {g === "WOMEN" ? t.women : t.men}
              </button>
            ))}
          </div>
          <Header title={t.whatTitle} />
          {genderCats.some((c) => c.services.some((s) => s.isPopular)) && (
            <div className="mb-5">
              <div className="mb-2 text-sm font-medium text-neutral-400">{t.popular}</div>
              <div className="flex flex-wrap gap-2">
                {genderCats
                  .flatMap((c) => c.services)
                  .filter((s) => s.isPopular)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      className={`rounded-full border px-4 py-2 text-sm ${selected.has(s.id) ? "border-orange-500 bg-orange-500/15 text-orange-300" : "border-white/15 hover:border-white/40"}`}
                    >
                      {s.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2">
            {genderCats.map((c) => (
              <details key={c.id} className="rounded-xl border border-white/10 bg-white/5">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{c.name}</summary>
                <ul className="border-t border-white/10">
                  {c.services.map((s) => {
                    const min = Math.min(...s.variants.map((v) => v.priceCents));
                    const from = isTiered(s) || s.variants.some((v) => ["FROM", "ON_REQUEST"].includes(v.priceType));
                    const sel = selected.has(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => toggle(s.id)}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${sel ? "bg-orange-500/10" : "hover:bg-white/5"}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded border ${sel ? "border-orange-500 bg-orange-500 text-white" : "border-neutral-600"}`}>
                              {sel ? "✓" : ""}
                            </span>
                            {s.name}
                            {s.isAddOn && <span className="rounded-full bg-white/10 px-1.5 text-xs text-neutral-400">{t.extra}</span>}
                          </span>
                          <span className="shrink-0 text-neutral-400">
                            {from ? `${t.from} ` : ""}
                            {euro(min)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
          {selected.size > 0 && (
            <SummaryBar
              cta={t.next}
              onClick={() => setStep(needsLength ? "length" : "barber")}
            />
          )}
        </div>
      )}

      {/* STEP: length */}
      {step === "length" && (
        <div>
          <Header title={t.lengthTitle} back={() => setStep("services")} />
          <p className="mb-4 text-sm text-neutral-400">{t.lengthHint}</p>
          <div className="grid grid-cols-3 gap-3">
            {(["Kurz", "Mittel", "Lang"] as Length[]).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLength(l);
                  setStep("barber");
                }}
                className={`rounded-2xl border p-6 font-medium ${length === l ? "border-orange-500 bg-orange-500/15" : "border-white/15 hover:border-orange-400"}`}
              >
                {t.lengths[l]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP: barber */}
      {step === "barber" && (
        <div>
          <Header title={t.whoTitle} back={() => setStep(needsLength ? "length" : "services")} />
          {qualifiedBarbers.length === 0 ? (
            <p className="text-sm text-neutral-400">{t.noCombo}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {qualifiedBarbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setBarberId(b.id);
                    const days = upcomingDays(b);
                    const d = days[0]?.date ?? null;
                    setDate(d);
                    setStep("time");
                    if (d) loadSlots(b.id, d);
                  }}
                  className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:border-orange-400"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.photoUrl ?? "/barber-placeholder.svg"}
                    alt={b.name}
                    className="h-28 w-full object-cover"
                  />
                  <div className="flex flex-1 flex-col p-3">
                    <span className="font-medium">{b.name}</span>
                    {b.reviewCount > 0 ? (
                      <div className="mt-0.5 text-sm">
                        <Stars value={b.avgRating} />{" "}
                        <span className="text-xs text-neutral-400">({b.reviewCount})</span>
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs text-neutral-400">{t.noReviews}</div>
                    )}
                    {b.bio && (
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{b.bio}</p>
                    )}
                    {b.reviews[0]?.comment && (
                      <p className="mt-1 line-clamp-2 text-xs italic text-neutral-400">
                        „{b.reviews[0].comment}“
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP: time */}
      {step === "time" && barber && (
        <div>
          <Header title={t.whenTitle} back={() => setStep("barber")} />
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {upcomingDays(barber).map((d) => (
              <button
                key={d.date}
                onClick={() => {
                  setDate(d.date);
                  loadSlots(barber.id, d.date);
                }}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm ${date === d.date ? "border-orange-500 bg-orange-500/15 text-orange-300" : "border-white/15"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {loadingSlots || pending ? (
            <p className="text-sm text-neutral-400">{t.loadingSlots}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-neutral-400">{t.noSlots}</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSlot(s);
                    setStep("details");
                  }}
                  className="rounded-lg border border-white/15 py-2 text-sm hover:border-orange-500 hover:bg-orange-500/10"
                >
                  {fmtTime(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP: details */}
      {step === "details" && barber && slot && (
        <div>
          <Header title={t.detailsTitle} back={() => setStep("time")} />
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <div className="font-medium">{items.map((it) => it.service.name + (isTiered(it.service) ? ` (${t.lengths[effLength]})` : "")).join(", ")}</div>
            <div className="text-neutral-400">
              {barber.name} · {fmtTime(slot)} · {new Date(slot).toLocaleDateString(loc, { weekday: "long", day: "2-digit", month: "long", timeZone: "Europe/Berlin" })}
            </div>
            <div className="mt-1">
              {showFrom ? `${t.from} ` : ""}
              {euro(totalPrice)} · {fmtDur(totalDuration)}
            </div>
          </div>
          {error && <div className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
          <div className="space-y-3">
            {([
              ["name", t.name, "text"],
              ["email", t.email, "email"],
              ["phone", t.phone, "tel"],
            ] as const).map(([k, label, type]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-neutral-300">{label}</label>
                <input
                  type={type}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-orange-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-neutral-300">{t.note}</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <button
            onClick={submit}
            disabled={pending || !form.name || !form.email || !form.phone}
            className="mt-5 w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? t.submitting : t.submit}
          </button>
          <p className="mt-2 text-center text-xs text-neutral-400">{t.payOnSite}</p>
        </div>
      )}

      {/* STEP: done */}
      {step === "done" && barber && slot && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-3xl text-green-400">✓</div>
          <h2 className="text-xl font-semibold">{t.doneTitle}</h2>
          <p className="mt-1 text-sm text-neutral-400">{t.doneText} {form.name}.</p>
          <div className="mx-auto mt-5 max-w-sm rounded-xl border border-white/10 bg-white/5 p-4 text-left text-sm">
            <div className="font-medium">{items.map((it) => it.service.name).join(", ")}</div>
            <div className="text-neutral-400">
              {barber.name} · {new Date(slot).toLocaleDateString(loc, { weekday: "long", day: "2-digit", month: "long", timeZone: "Europe/Berlin" })} {t.at} {fmtTime(slot)}{t.clock ? ` ${t.clock}` : ""}
            </div>
            <div className="mt-1">
              {showFrom ? `${t.from} ` : ""}
              {euro(totalPrice)} · {fmtDur(totalDuration)} · {t.payNote}
            </div>
          </div>
          <a
            href={`/booking/${manageToken}`}
            className="mt-5 inline-block rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-neutral-200 hover:bg-white/10"
          >
            {t.manage}
          </a>
          <p className="mt-4 text-xs text-neutral-400">{t.emailNote}</p>
        </div>
      )}
      </div>
    </main>
  );
}
