"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { getSlots, getSlotsAny, getOpenDays, createBooking } from "@/app/book/actions";
import { dict, dateLocale, type Locale } from "@/lib/i18n";
import { tName } from "@/lib/service-i18n";
import { BOOKING_LIMITS } from "@/lib/booking-limits";
import { LanguageSwitch } from "./language-switch";
import { MonthPicker, isoWeekday, ymd } from "./month-picker";

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
  nameEn: string | null;
  isAddOn: boolean;
  isPopular: boolean;
  variants: Variant[];
};
type Category = { id: string; name: string; nameEn: string | null; gender: string; services: Service[] };
type Barber = {
  id: string;
  name: string;
  gender: string;
  bio: string | null;
  bioEn?: string | null;
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
  /** True when a mail transport is configured (changes the note on the done screen). */
  emailLive?: boolean;
};

type Length = "Kurz" | "Mittel" | "Lang";
type Step = "services" | "length" | "barber" | "time" | "details" | "done";
type Slot = { iso: string; stylistId: string };
const ANY = "ANY";
const LENGTHS: Length[] = ["Kurz", "Mittel", "Lang"];

// ── helpers ──────────────────────────────────────────────────
const euroFmt = (cents: number, loc: string) =>
  new Intl.NumberFormat(loc, { style: "currency", currency: "EUR" }).format(cents / 100);
const fmtTimeFmt = (iso: string, loc: string) =>
  new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
const hourInBerlin = (iso: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Berlin" }).format(new Date(iso)));

const isTiered = (s: Service) => s.variants.length > 1;

function pickVariant(s: Service, length: Length): Variant {
  if (s.variants.length === 1) return s.variants[0];
  const find = (l: string) => s.variants.find((v) => v.label.startsWith(l));
  const exact = find(length);
  if (exact) return exact;
  const idx = LENGTHS.indexOf(length);
  for (let d = 1; d < LENGTHS.length; d++) {
    const hi = LENGTHS[idx + d] && find(LENGTHS[idx + d]);
    const lo = LENGTHS[idx - d] && find(LENGTHS[idx - d]);
    if (hi) return hi;
    if (lo) return lo;
  }
  return s.variants[0];
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400" aria-label={`${value}/5`}>
      {"★".repeat(Math.round(value))}
      <span className="text-neutral-600">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

// ── component ────────────────────────────────────────────────
export function BookingWizard({ categories, barbers, bookingWindowDays, locale, emailLive = false }: Props) {
  const t = dict[locale].book;
  const loc = dateLocale[locale];
  const WD_SHORT = dict[locale].weekdaysShort;
  const euro = (cents: number) => euroFmt(cents, loc);
  const fmtTime = (iso: string) => fmtTimeFmt(iso, loc);
  const fmtDur = (m: number) =>
    m < 60 ? `${m} ${t.min}` : m % 60 ? `${Math.floor(m / 60)} ${t.hours} ${m % 60} ${t.min}` : `${Math.floor(m / 60)} ${t.hours}`;

  const [step, setStep] = useState<Step>("services");
  const [gender, setGender] = useState<"MEN" | "WOMEN">("MEN");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [length, setLength] = useState<Length | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null); // a barber id or ANY
  const [month, setMonth] = useState<string>(() => ymd(new Date()).slice(0, 7));
  const [openDays, setOpenDays] = useState<Set<string> | null>(null);
  const [loadingDays, setLoadingDays] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allServices = categories.flatMap((c) => c.services);
  const selectedServices = allServices.filter((s) => selected.has(s.id));
  const needsLength = selectedServices.some(isTiered);
  // Until a length is chosen, show the cheapest (short) price as "from".
  const effLength: Length = length ?? "Kurz";
  const itemsFor = (l: Length) => selectedServices.map((s) => ({ service: s, variant: pickVariant(s, l) }));
  const items = itemsFor(effLength);
  const totalDuration = items.reduce((n, it) => n + it.variant.durationMinutes, 0);
  const totalPrice = items.reduce((n, it) => n + it.variant.priceCents, 0);
  const variantIds = items.map((it) => it.variant.id);
  const showFrom = items.some((it) => ["FROM", "ON_REQUEST"].includes(it.variant.priceType)) || (needsLength && !length);
  const qualifiedBarbers = barbers.filter((b) => selectedServices.every((s) => b.serviceIds.includes(s.id)));
  const pickIds = barberId === ANY ? qualifiedBarbers.map((b) => b.id) : barberId ? [barberId] : [];
  const pickBarbers = barbers.filter((b) => pickIds.includes(b.id));
  const slotBarber = barbers.find((b) => b.id === slot?.stylistId) ?? null;
  const genderCats = categories.filter((c) => c.gender === gender);
  const serviceLabel = (s: Service) => tName(s.name, locale, s.nameEn);

  const todayStr = ymd(new Date());
  const lastDay = new Date();
  lastDay.setDate(lastDay.getDate() + bookingWindowDays);
  const maxDate = ymd(lastDay);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function fetchSlots(ids: string[], day: string): Promise<Slot[]> {
    if (ids.length === 1) return (await getSlots(ids[0], day, variantIds)).map((iso) => ({ iso, stylistId: ids[0] }));
    return getSlotsAny(ids, day, variantIds);
  }

  function loadDay(ids: string[], day: string) {
    setDate(day);
    setSlot(null);
    setSlots([]);
    setLoadingSlots(true);
    startTransition(async () => {
      setSlots(await fetchSlots(ids, day));
      setLoadingSlots(false);
    });
  }

  /** Loads which days of `m` have free times; with `autoPick`, jumps to the first one (looking ahead a month if needed). */
  function loadMonth(ids: string[], m: string, autoPick: boolean) {
    setMonth(m);
    setLoadingDays(true);
    startTransition(async () => {
      let shown = m;
      let open = await getOpenDays(ids, shown, variantIds);
      if (autoPick && open.length === 0 && shown < maxDate.slice(0, 7)) {
        const [y, mo] = shown.split("-").map(Number);
        shown = ymd(new Date(y, mo, 1)).slice(0, 7);
        open = await getOpenDays(ids, shown, variantIds);
        setMonth(shown);
      }
      setOpenDays(new Set(open));
      setLoadingDays(false);
      if (autoPick && open[0]) {
        setDate(open[0]);
        setLoadingSlots(true);
        setSlots(await fetchSlots(ids, open[0]));
        setLoadingSlots(false);
      }
    });
  }

  function chooseBarber(id: string) {
    const ids = id === ANY ? qualifiedBarbers.map((b) => b.id) : [id];
    setBarberId(id);
    setDate(null);
    setSlot(null);
    setSlots([]);
    setOpenDays(null);
    setError(null);
    setStep("time");
    loadMonth(ids, todayStr.slice(0, 7), true);
  }

  function submit() {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const res = await createBooking({
        stylistId: slot.stylistId,
        variantIds,
        startAt: slot.iso,
        name: form.name,
        email: form.email,
        phone: form.phone,
        note: form.note,
        website: form.website,
        locale,
      });
      if (res.ok) {
        setManageToken(res.manageToken);
        setStep("done");
      } else {
        setError(t.errors[res.error]);
        if ((res.error === "slotUnavailable" || res.error === "slotTaken") && date) {
          setStep("time");
          loadDay(pickIds, date);
        }
      }
    });
  }

  // ── shells (render helpers, not components: defining components inside a
  // component remounts them on every render) ──────────────────────────────
  const header = (title: string, back?: () => void) => (
    <div className="mb-4 flex items-center gap-3">
      {back && (
        <button onClick={back} className="text-sm text-neutral-400 hover:text-white">
          {t.back}
        </button>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );

  const priceText = `${showFrom ? `${t.from} ` : ""}${euro(totalPrice)}`;

  /** What's selected so far, shown above the later steps. */
  const selection = () => (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm">
      <div className="font-medium">
        {items.map((it) => serviceLabel(it.service) + (length && isTiered(it.service) ? ` (${t.lengths[length]})` : "")).join(", ")}
      </div>
      <div className="text-neutral-400">
        {priceText} · ≈ {fmtDur(totalDuration)}
        {slotBarber && step === "details" ? ` · ${t.with} ${slotBarber.name}` : ""}
      </div>
    </div>
  );

  const summaryBar = (cta: string, onClick: () => void, disabled?: boolean) => (
    <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t border-white/10 bg-neutral-950/90 py-3 backdrop-blur">
      <div className="text-sm">
        <div className="font-medium">
          {selected.size} {selected.size === 1 ? t.service : t.services} · {priceText}
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

  const slotGroups = (() => {
    const groups: { label: string; slots: Slot[] }[] = [
      { label: t.morning, slots: [] },
      { label: t.afternoon, slots: [] },
      { label: t.evening, slots: [] },
    ];
    for (const s of slots) {
      const h = hourInBerlin(s.iso);
      groups[h < 12 ? 0 : h < 17 ? 1 : 2].slots.push(s);
    }
    return groups.filter((g) => g.slots.length > 0);
  })();

  const workingWeekdays = new Set(pickBarbers.flatMap((b) => b.workingWeekdays));

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-2 flex justify-end">
          <LanguageSwitch locale={locale} />
        </div>
        <div className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-orange-400">{t.kicker}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            <Link href="/" className="transition hover:text-orange-400">
              Paradiso
            </Link>{" "}
            · {t.title}
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
                    setLength(null);
                  }}
                  className={`flex-1 rounded-full px-4 py-2 text-center text-sm font-medium outline-none transition ${gender === g ? "bg-orange-500 text-white shadow-sm" : "text-neutral-400 hover:text-white"}`}
                >
                  {g === "WOMEN" ? t.women : t.men}
                </button>
              ))}
            </div>
            {header(t.whatTitle)}
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
                        {serviceLabel(s)}
                      </button>
                    ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2">
              {genderCats.map((c) => (
                <details key={c.id} className="rounded-xl border border-white/10 bg-white/5">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{tName(c.name, locale, c.nameEn)}</summary>
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
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${sel ? "border-orange-500 bg-orange-500 text-white" : "border-neutral-600"}`}>
                                {sel ? "✓" : ""}
                              </span>
                              {serviceLabel(s)}
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
            {selected.size > 0 && summaryBar(t.next, () => setStep(needsLength ? "length" : "barber"))}
          </div>
        )}

        {/* STEP: length */}
        {step === "length" && (
          <div>
            {header(t.lengthTitle, () => setStep("services"))}
            <p className="mb-4 text-sm text-neutral-400">{t.lengthHint}</p>
            <div className="grid grid-cols-3 gap-3">
              {LENGTHS.map((l) => {
                const its = itemsFor(l);
                const price = its.reduce((n, it) => n + it.variant.priceCents, 0);
                const dur = its.reduce((n, it) => n + it.variant.durationMinutes, 0);
                return (
                  <button
                    key={l}
                    onClick={() => {
                      setLength(l);
                      setStep("barber");
                    }}
                    className={`rounded-2xl border px-2 py-5 ${length === l ? "border-orange-500 bg-orange-500/15" : "border-white/15 hover:border-orange-400"}`}
                  >
                    <div className="font-medium">{t.lengths[l]}</div>
                    <div className="mt-1 text-sm text-neutral-300">{euro(price)}</div>
                    <div className="text-xs text-neutral-500">≈ {fmtDur(dur)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: barber */}
        {step === "barber" && (
          <div>
            {header(t.whoTitle, () => setStep(needsLength ? "length" : "services"))}
            {selection()}
            {qualifiedBarbers.length === 0 ? (
              <p className="text-sm text-neutral-400">{t.noCombo}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {qualifiedBarbers.length > 1 && (
                  <button
                    onClick={() => chooseBarber(ANY)}
                    className="col-span-2 flex items-center gap-4 rounded-2xl border border-orange-500/40 bg-orange-500/10 p-4 text-left transition hover:border-orange-400"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xl font-semibold text-white">✓</span>
                    <span>
                      <span className="block font-medium">{t.anyTitle}</span>
                      <span className="block text-sm text-neutral-400">{t.anyText}</span>
                    </span>
                  </button>
                )}
                {qualifiedBarbers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => chooseBarber(b.id)}
                    className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:border-orange-400"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.photoUrl ?? "/barber-placeholder.svg"} alt={b.name} className="h-28 w-full object-cover" />
                    <div className="flex flex-1 flex-col p-3">
                      <span className="font-medium">{b.name}</span>
                      {b.reviewCount > 0 ? (
                        <div className="mt-0.5 text-sm">
                          <Stars value={b.avgRating} /> <span className="text-xs text-neutral-400">({b.reviewCount})</span>
                        </div>
                      ) : (
                        <div className="mt-0.5 text-xs text-neutral-400">{t.noReviews}</div>
                      )}
                      {b.bio && <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{tName(b.bio, locale, b.bioEn)}</p>}
                      {b.reviews[0]?.comment && (
                        <p className="mt-1 line-clamp-2 text-xs italic text-neutral-400">„{b.reviews[0].comment}“</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP: time */}
        {step === "time" && barberId && (
          <div>
            {header(t.whenTitle, () => setStep("barber"))}
            {selection()}
            <p className="-mt-2 mb-3 text-sm text-neutral-400">
              {barberId === ANY ? t.anyTitle : `${t.with} ${pickBarbers[0]?.name ?? ""}`}
            </p>
            {error && <div className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
            <div className="mb-5">
              <MonthPicker
                month={month}
                onMonthChange={(m) => loadMonth(pickIds, m, false)}
                value={date}
                onPick={(d) => loadDay(pickIds, d)}
                isOpen={(d) => (openDays ? openDays.has(d) : workingWeekdays.has(isoWeekday(new Date(`${d}T12:00:00`))))}
                minDate={todayStr}
                maxDate={maxDate}
                loading={loadingDays}
                weekdaysShort={WD_SHORT}
                locale={loc}
                prevLabel={t.prevMonth}
                nextLabel={t.nextMonth}
              />
            </div>
            {date && (
              <p className="mb-3 text-sm font-medium">
                {new Date(`${date}T12:00:00`).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}
              </p>
            )}
            {loadingSlots || (pending && slots.length === 0) ? (
              <p className="text-sm text-neutral-400">{t.loadingSlots}</p>
            ) : !date ? null : slots.length === 0 ? (
              <p className="text-sm text-neutral-400">{t.noSlots}</p>
            ) : (
              <div className="space-y-4">
                {slotGroups.map((g) => (
                  <div key={g.label}>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">{g.label}</div>
                    <div className="grid grid-cols-4 gap-2">
                      {g.slots.map((s) => (
                        <button
                          key={s.iso}
                          onClick={() => {
                            setSlot(s);
                            setError(null);
                            setStep("details");
                          }}
                          className="rounded-lg border border-white/15 py-2 text-sm hover:border-orange-500 hover:bg-orange-500/10"
                        >
                          {fmtTime(s.iso)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP: details */}
        {step === "details" && slotBarber && slot && (
          <div>
            {header(t.detailsTitle, () => setStep("time"))}
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <div className="font-medium">
                {items.map((it) => serviceLabel(it.service) + (isTiered(it.service) ? ` (${t.lengths[effLength]})` : "")).join(", ")}
              </div>
              <div className="text-neutral-400">
                {slotBarber.name} · {fmtTime(slot.iso)} ·{" "}
                {new Date(slot.iso).toLocaleDateString(loc, { weekday: "long", day: "2-digit", month: "long", timeZone: "Europe/Berlin" })}
              </div>
              <div className="mt-1">
                {priceText} · {fmtDur(totalDuration)}
              </div>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
            <div className="space-y-3">
              {(
                [
                  ["name", t.name, "text", "name"],
                  ["email", t.email, "email", "email"],
                  ["phone", t.phone, "tel", "tel"],
                ] as const
              ).map(([k, label, type, autoComplete]) => (
                <label key={k} className="block text-sm font-medium text-neutral-300">
                  {label}
                  <input
                    type={type}
                    autoComplete={autoComplete}
                    maxLength={BOOKING_LIMITS[k]}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-normal text-white outline-none focus:border-orange-500"
                  />
                </label>
              ))}
              <label className="block text-sm font-medium text-neutral-300">
                {t.note}
                <textarea
                  value={form.note}
                  maxLength={BOOKING_LIMITS.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-normal text-white outline-none focus:border-orange-500"
                />
              </label>
              {/* Honeypot: off-screen and skipped by keyboard/screen readers; bots that fill every field get rejected. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>
                  Website
                  <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                </label>
              </div>
            </div>
            <button
              onClick={submit}
              disabled={pending || !form.name || !form.email}
              className="mt-5 w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {pending ? t.submitting : t.submit}
            </button>
            <p className="mt-2 text-center text-xs text-neutral-400">{t.payOnSite}</p>
            <p className="mt-1 text-center text-xs text-neutral-500">
              {t.privacyBefore}
              <Link href="/datenschutz" target="_blank" className="underline hover:text-neutral-300">
                {t.privacyLink}
              </Link>
              {t.privacyAfter}
            </p>
          </div>
        )}

        {/* STEP: done */}
        {step === "done" && slotBarber && slot && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-3xl text-green-400">✓</div>
            <h2 className="text-xl font-semibold">{t.doneTitle}</h2>
            <p className="mt-1 text-sm text-neutral-400">
              {t.doneText} {form.name}.
            </p>
            <div className="mx-auto mt-5 max-w-sm rounded-xl border border-white/10 bg-white/5 p-4 text-left text-sm">
              <div className="font-medium">{items.map((it) => serviceLabel(it.service)).join(", ")}</div>
              <div className="text-neutral-400">
                {slotBarber.name} ·{" "}
                {new Date(slot.iso).toLocaleDateString(loc, { weekday: "long", day: "2-digit", month: "long", timeZone: "Europe/Berlin" })} {t.at}{" "}
                {fmtTime(slot.iso)}
                {t.clock ? ` ${t.clock}` : ""}
              </div>
              <div className="mt-1">
                {priceText} · {fmtDur(totalDuration)} · {t.payNote}
              </div>
            </div>
            <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href={`/booking/${manageToken}/calendar.ics`}
                className="inline-block rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
              >
                {dict[locale].manage.addToCalendar}
              </a>
              <a
                href={`/booking/${manageToken}`}
                className="inline-block rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-neutral-200 hover:bg-white/10"
              >
                {t.manage}
              </a>
            </div>
            <p className="mt-4 text-xs text-neutral-400">{emailLive ? t.emailNoteLive : t.emailNote}</p>
          </div>
        )}
      </div>
    </main>
  );
}
