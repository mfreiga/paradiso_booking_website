# Hairstyling Paradiso — Online Booking System

**Technical Specification — v1**
_Working project name: "Paratizo". Status: **PLANNING / pre-build**. Last updated: 2026-06-04._

---

## ⚠️ Pending info before / during build (read me first)

These don't block starting, but we need them to finish v1. Details in [§17](#17-open-questions--info-still-needed).

1. **Service durations** — the price list has prices but **no durations**. The slot engine is built entirely on duration. §9 contains *proposed estimates* — **the shop must confirm/adjust them.**
2. **Barber details** — names, photos, bios, and **weekly working hours** for the 3 male + 2 female barbers. Which services each one does (default mapping proposed in §9).
3. **Shop info** — exact address, opening hours, confirm timezone (assumed `Europe/Berlin`), logo/brand colors.
4. **Booking rules** — how far ahead bookings open, minimum notice, cancellation cutoff, buffer/cleanup time (defaults proposed in §15).
5. **Languages** — German confirmed primary; English likely. Others (Arabic, etc.)? (§15)
6. **Reviews policy** — auto-publish vs admin-approve; show full name or first name + initial. (§12)
7. **Domain & hosting** — do they have a domain? Hosting plan in §16.

---

## Table of contents

1. [Overview & goals](#1-overview--goals)
2. [Key facts (from the price list)](#2-key-facts-from-the-price-list)
3. [Users & roles](#3-users--roles)
4. [Core mechanic: the three axes & duration-driven slots](#4-core-mechanic-the-three-axes--duration-driven-slots)
5. [Tech stack](#5-tech-stack)
6. [Data model](#6-data-model)
7. [The booking flow (customer UX)](#7-the-booking-flow-customer-ux)
8. [The slot engine](#8-the-slot-engine)
9. [Service catalog (full menu + proposed durations)](#9-service-catalog-full-menu--proposed-durations)
10. [Reviews](#10-reviews)
11. [Admin panel](#11-admin-panel)
12. [Pages / screens list](#12-pages--screens-list)
13. [Transactional emails](#13-transactional-emails)
14. [Ease-of-use principles](#14-ease-of-use-principles)
15. [Configuration & settings](#15-configuration--settings)
16. [Build order / milestones](#16-build-order--milestones)
17. [Open questions / info still needed](#17-open-questions--info-still-needed)
18. [Out of scope for v1 / future (v2+)](#18-out-of-scope-for-v1--future-v2)

---

## 1. Overview & goals

A web app for **Hairstyling Paradiso** (Munich) where customers book appointments online by choosing **what** they want done, **who** they want to do it, and **when**.

The defining challenge: **appointment length is not fixed** — it depends on the chosen service(s), and for women's services also on **hair length** (short/medium/long). So a "Bart Kontur" (beard line-up) might be 10 min while a "Balayage" is 3 hours. The whole system is built so that available time slots are **computed on the fly** from the selected work and the chosen barber's real availability.

**Primary goals**
- Dead-simple booking, **no customer account or password required**.
- Correct, conflict-free availability that respects each service's real duration.
- Pick a specific barber and **see their reviews/ratings** before booking.
- A single **admin** who manages the menu, the barbers, their schedules, and all bookings.

**Non-goals for v1:** online payment (pay in shop), SMS/reminders, multiple locations, loyalty/marketing. See §18.

---

## 2. Key facts (from the price list)

| Fact | Value | Why it matters |
|---|---|---|
| Location | Munich, Germany (tel **089 – 32 66 81 82**) | Timezone `Europe/Berlin`, currency **EUR** |
| Primary language | **German** | UI defaults to German; English likely secondary |
| Spoken languages | DE, AR, ES, EN, RU, EL, UK | Possible multi-language UI later |
| Appointments | **"Mit und ohne Termin"** (with & without) | Walk-ins exist → admin needs walk-in entry & time blocking |
| Top-level split | **DAMEN** (women) / **HERREN** (men) | First choice in the booking flow; filters the menu + barbers |
| Women's pricing | **3 tiers: Kurz (K) / Mittel (M) / Lang (L)** | A length axis → modelled as **service variants** (price + duration per length) |
| Men's pricing | Mostly single price | One "Standard" variant per service |
| Kids | "Mädchen bis 10 Jahre", "Jungs bis 10 Jahre" | A kids category under each gender |
| Price types seen | exact (`27€`), **"ab" (from) (`ab 98€`)**, **"Auf Anfrage" (on request)** | Price needs a **type**: FIXED / FROM / ON_REQUEST |
| Modifiers | e.g. "Farbe bei längeren Haaren (Aufschlag) **+5€**", "Musterrasur (**pro Seite**)" | Some entries are surcharges/per-unit, not standalone bookings |
| Add-ons | e.g. Conditioner 3€, Pony schneiden 7€, Bart Kontur 10€ | Short extras usually added to a main service |
| Barbers | **3 male + 2 female** (names TBD) | Gender specialization; reviews per barber |

---

## 3. Users & roles

**There are no customer accounts.** Customers never log in; only the admin does (email + password).

| Role | Auth | What they can do |
|---|---|---|
| **Customer** | None. Enters name / email / phone at booking. Manages a booking via a secret link emailed to them. | Browse menu, book, view/cancel (and reschedule) their own booking via the email link, leave a review after the appointment. |
| **Admin** (shop owner/front desk) | **Email + password** (Auth.js Credentials + JWT). Dev: single shared credential from env; **production: switch to hashed, per-user passwords**. | Full management: menu, barbers, schedules, all bookings, walk-ins, reviews, settings. |

> The data model leaves room for a future **stylist** role (each barber logs in to see their own day) — **deferred to v2** (§18). v1 is admin-only.

---

## 4. Core mechanic: the three axes & duration-driven slots

A booking is defined by **three axes**:

1. **Gender** — Damen / Herren (top-level filter for menu + barbers).
2. **Service(s)** — one or more menu items (e.g. "Waschen, Schneiden, Föhnen" + "Augenbrauen").
3. **Length variant** — for women's services only: **Kurz / Mittel / Lang**. Each variant carries its **own price and its own duration**.

From the selected variants we compute:

```
total_duration = Σ (variant.durationMinutes)  [+ optional cleanup buffer]
total_price    = Σ (variant.price)            [shown as "from" if any variant is FROM]
```

`total_duration` is then fed to the **slot engine** (§8), which finds real openings in the chosen barber's day big enough to fit it. Short job → many slots; long job → few. **Slots are never stored — always computed**, so they're always correct.

---

## 5. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js** (App Router, React, TypeScript) | One codebase: customer site + admin + API routes |
| Styling/UI | **Tailwind CSS** + **shadcn/ui** | Fast, clean, mobile-first components |
| Database | **PostgreSQL** | Relational; range/exclusion constraints prevent double-booking |
| ORM | **Prisma** | Type-safe schema & queries |
| Admin auth | **Auth.js (NextAuth)** — Credentials (email + password), JWT sessions | Protects `/admin/*`; dev password from env (harden for prod) |
| Email | **Resend** | Magic links, booking confirmation + manage link, review request |
| Dates/time | **Luxon** (or `date-fns-tz`) | Store UTC, compute in `Europe/Berlin` |
| Hosting | **Vercel** + hosted Postgres (**Neon** or **Supabase**) | Cheap, simple; free tiers fine to start |
| i18n | **next-intl** (German default) | Structured for adding English later |

---

## 6. Data model

Money stored as **integer cents**. Datetimes stored **UTC**, displayed in shop timezone.

### Entities

**Category** — menu grouping.
- `id`, `name` (e.g. "Schneiden & Styling"), `gender` (MEN | WOMEN | UNISEX), `displayOrder`, `isActive`

**Service** — a menu item.
- `id`, `name`, `description?`, `categoryId`, `gender` (MEN | WOMEN | UNISEX)
- `isAddOn` (bool — short extras like Conditioner; bookable only alongside a main service)
- `isPopular` (bool — surfaced as a "quick book" tile; see §7.1)
- `isActive`, `displayOrder`

**ServiceVariant** — price + duration for a service. **This is the key table.**
- `id`, `serviceId`
- `label` (e.g. "Standard", "Kurz", "Mittel", "Lang")
- `priceCents`
- `priceType` (FIXED | FROM | ON_REQUEST)
- `durationMinutes`
- `displayOrder`
- _Single-price services → one variant ("Standard"). Length-tiered women's services → three variants._

**Stylist** (barber)
- `id`, `name`, `gender` (MALE | FEMALE), `bio?`, `photoUrl?`, `isActive`, `displayOrder`
- (derived/denormalized) `avgRating`, `reviewCount`

**StylistService** — which barber performs which service (M:N join).
- `stylistId`, `serviceId` (composite PK)
- _Source of truth for "who can do this." A barber linked only to men's services is effectively a men's barber._

**WorkingHours** — recurring weekly availability.
- `id`, `stylistId`, `dayOfWeek` (0–6), `startTime`, `endTime`
- _Multiple rows per day allowed (e.g. split shift / lunch gap)._

**TimeOff** — one-off unavailability (vacation, sick, blocks).
- `id`, `stylistId`, `startAt`, `endAt`, `reason?`

**Appointment**
- `id`, `stylistId`
- `customerName`, `customerEmail`, `customerPhone`, `customerId?` (→ optional Customer)
- `startAt`, `endAt` (UTC; `endAt = startAt + totalDuration [+buffer]`)
- `status` (PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW)
- `totalPriceCents`, `totalDurationMinutes` (snapshots)
- `priceIsFrom` (bool — true if any item was FROM)
- `customerNote?`, `adminNote?`
- `manageToken` (random, unique, indexed — the cancel/reschedule link)
- `reviewToken` (random, unique — the review link)
- `source` (CUSTOMER | ADMIN — walk-ins/phone bookings = ADMIN)
- `createdAt`, `updatedAt`

**AppointmentItem** — services in an appointment (snapshotted so history stays correct if the menu later changes).
- `id`, `appointmentId`, `serviceId`, `serviceVariantId`
- `nameSnapshot`, `variantLabelSnapshot`, `priceCentsSnapshot`, `durationMinutesSnapshot`

**Review**
- `id`, `stylistId`, `appointmentId?` (verifies it's from a real visit)
- `displayName` (first name + initial, per policy), `rating` (1–5), `comment?`
- `status` (PENDING | PUBLISHED | HIDDEN)
- `createdAt`

**Customer** _(optional, lightweight — no password)_
- `id`, `email` (unique), `name`, `phone`, `createdAt`
- _Auto-created/looked-up by email at booking so admin can see a customer's history. No login._

**AdminUser**
- `id`, `email` (unique), `name`, `role` (ADMIN; reserved: STAFF)
- _No password — Auth.js handles magic-link sessions/tokens._

**Setting** — singleton config (timezone, booking window, lead time, slot granularity, default buffer, shop contact, cancellation cutoff). See §15.

### Double-booking prevention

A Postgres **exclusion constraint** stops two overlapping live bookings for the same barber:

```sql
-- requires btree_gist
ALTER TABLE "Appointment" ADD CONSTRAINT no_overlap
EXCLUDE USING gist (
  "stylistId" WITH =,
  tstzrange("startAt", "endAt") WITH &&
) WHERE (status IN ('PENDING','CONFIRMED'));
```

At confirmation the server re-validates the slot inside a transaction; whoever clicks second gets a friendly "just taken, pick another." This is the safety net against the race where two people grab the same slot.

---

## 7. The booking flow (customer UX)

Mobile-first, minimal typing, a sticky running total, and the ability to go back without losing selections.

```
Step 1  Damen or Herren?        big two-option choice (filters everything below)
Step 2  Choose service(s)        grouped by category; pick length (K/M/L) where it applies;
                                  add-ons offered; sticky bar shows running TIME + PRICE
Step 3  Choose barber            only barbers who can do ALL selected services;
                                  photo, ★rating, review count, short bio, "next available";
                                  option: "No preference — earliest available"
Step 4  Pick date & time         calendar + slot list for that barber & total duration;
                                  full days greyed out; times shown in Munich time
Step 5  Your details             name, email, phone, optional note — NO password
Confirm  Summary + done          on-screen confirmation + "add to calendar" (.ics);
                                  confirmation email with a manage/cancel link is sent
```

**Hair length (asked once):** rather than asking per service, the wizard asks hair length **once** — a single Short / Medium / Long choice (with simple illustrations) — and applies it to every selected women's service to resolve each one's K/M/L variant. Helper text: _"Not sure? Pick your best guess — your stylist will confirm on the day."_ If a service doesn't offer the chosen tier, fall back to the nearest. Prices shown per length; "from" (ab) prices clearly labelled. See §7.1.

**Manage page** (opened from the email link, no login): shows the booking with **Cancel** and **Reschedule** (reschedule re-runs Step 4 for the same services + barber). Cancellation respects the cutoff (§15); inside the cutoff it says "please call the shop."

**On-request / "Auf Anfrage" services** (e.g. 20+ tapes): not directly bookable online → shown as **"Enquire"** with the shop phone, or bookable as a "consultation" placeholder. (Decision pending — §17.)

### 7.1 Handling "too many options" (information architecture)

The catalog is large (~50+ items across both genders). The flow stays simple by **never showing everything at once** and defaulting the common path to a few taps:

1. **Gender first** — Damen/Herren halves the menu instantly.
2. **"Popular / quick book" tiles** — admin-flagged top services (e.g. men's cut, "Waschen, Schneiden, Föhnen", beard, colour) shown first. One tap covers the most common visits and skips the long list. (Backed by `Service.isPopular`.)
3. **Browse by category** — collapsible accordions mirroring the price-list sections (Schneiden & Styling, Färben, Blondierung…), expanded one at a time, plus a type-ahead **search** for people who know exactly what they want.
4. **Ask hair length once** — a single global Short/Medium/Long question resolves the K/M/L variant for *all* selected services (not asked per item).
5. **Add-ons in context** — after a main service, short extras (Augenbrauen, Conditioner, Pony…) appear as optional toggles via `isAddOn`, keeping the primary list uncluttered.
6. **Bundles (optional, v1.x)** — common combos ("Cut + Beard", "Wash, Cut & Blow-dry") as single tiles.
7. **Fewer decisions overall** — sticky running total (time + price), and **"earliest available"** as the default barber so picking a specific person is optional.

Net effect: the typical customer taps Gender → a popular tile → (length if relevant) → time → details — roughly **4–5 taps**, while the full long-tail menu stays one level away for those who want it.

---

## 8. The slot engine

**Input:** `serviceVariantIds[]`, `stylistId` (or `null` = any qualified barber), `date`.

**Algorithm:**
1. `D = Σ durationMinutes (+ buffer)`.
2. Load the barber's **WorkingHours** for that weekday → working windows.
3. Subtract existing **PENDING/CONFIRMED appointments** and **TimeOff** (each ± buffer) → free windows.
4. Within each free window, slide a window of length `D` at **slot granularity** (default 15 min); emit every start where `[start, start+D]` fits inside the window and shop hours.
5. Drop slots in the past or inside the **minimum lead time**.
6. Drop slots beyond the **booking window** (how far ahead bookings open).
7. **"Any barber":** run for every qualified barber, then **merge** start times (dedup), remembering which barbers are free at each — so we can auto-assign or let the customer pick.

**Qualified barber** = can perform **every** selected service (via StylistService) **and** matches the chosen gender.

**Config knobs** (see §15): slot granularity, cleanup buffer (global default + optional per-service), lead time, booking window.

**Correctness:** computed live (never stored) + the exclusion constraint (§6) = no double-bookings even under concurrency.

---

## 9. Service catalog (full menu + proposed durations)

Transcribed verbatim from **Paradiso Preisliste 2026**. Prices in EUR.
**⚠️ Durations are PROPOSED estimates to unblock the build — the shop MUST confirm/adjust each one** (they drive every available time slot). `ab` = "from". K/M/L = Kurz/Mittel/Lang (short/medium/long).

### DAMEN (Women)

#### Schneiden & Styling
| Service | Price K / M / L | Proposed duration K / M / L (min) |
|---|---|---|
| Schneiden, Trocknen | 27 / 32 / 39 | 30 / 40 / 45 |
| Waschen, Schneiden, Föhnen | 36 / 46 / 56 | 45 / 60 / 75 |
| Waschen, Schneiden, Trocknen | 30 / 35 / 41 | 40 / 50 / 60 |
| Waschen, Föhnen/legen | 26 / 31 / 38 | 30 / 40 / 45 |
| Nur Föhnen (ohne Waschen) | 23 / 28 / 34 | 20 / 30 / 40 |
| Pony schneiden | 7 (flat) | 10 |
| Augenbrauen | 7 (flat) | 10 |

#### Pflege _(add-ons)_
| Service | Price | Proposed duration |
|---|---|---|
| Conditioner | 3 | 5 |
| Intensive Kur | 6 | 10 |
| Haare Waschen | 8 | 10 |
| Vitaplex (inkl. Kopfmassage) | 15 | 20 |

#### Färben
| Service | Price K / M / L | Proposed duration K / M / L |
|---|---|---|
| Ansatzfarbe | 37 / 48 (2 Cm) / — | 45 / 60 / — |
| Farbe | 42 / 48 / 57 | 60 / 75 / 90 |
| Tönung | 35 / 41 / 48 | 45 / 60 / 75 |

#### Blondierung
| Service | Price K / M / L | Proposed duration K / M / L |
|---|---|---|
| Ansätze Blondierung | 39 / 48 / 58 | 60 / 75 / 90 |
| Softaufhellung (Blondierwäsche) | 42 / 47 / 57 | 90 / 105 / 120 |
| Glossing (Abmattierung) | 10 / 15 / 25 | 20 / 25 / 30 |

#### Strähnen
| Service | Price K / M / L | Proposed duration K / M / L |
|---|---|---|
| Haubensträhnen | ab 26 (flat) | 45 |
| Foliensträhnen (Oberkopf) | 38 / 46 / 51 | 60 / 75 / 90 |
| Foliensträhnen (halber Kopf) | 44 / 49 / 55 | 75 / 90 / 105 |
| Foliensträhnen (ganzer Kopf) | 51 / 59 / 69 | 90 / 105 / 120 |
| Balayage (inkl. Glossing) | — / ab 98 / ab 129 | — / 150 / 180 |

#### Dauerhafte Umformung
| Service | Price K / M / L | Proposed duration K / M / L |
|---|---|---|
| Dauerwelle klassisch | 55 / 65 / 75 | 90 / 105 / 120 |
| Dauerwelle mit Technik | ab 55 (L) | 120 |

#### Keratinbehandlung
| Service | Price | Proposed duration |
|---|---|---|
| Keratinbehandlung inkl. Glättung | ab 130 | 150 |
| Haar-Botox | ab 120 | 90 |
| Flächen | ab 15 | 30 |

#### Mädchen bis 10 Jahre _(Schneiden)_
| Service | Price | Proposed duration |
|---|---|---|
| Schneiden, Trocknen | 20 | 30 |
| Waschen, Schneiden, Föhnen | 29 | 40 |
| Waschen, Schneiden, Trocknen | 25 | 35 |

#### Besondere Anlässe
| Service | Price | Proposed duration |
|---|---|---|
| Hochsteckfrisur | ab 45 | 60 |
| Braut (inkl. Probehochstecken und Beratung) | ab 185 | 120 |

### HERREN (Men)

#### Schneiden & Styling
| Service | Price | Proposed duration |
|---|---|---|
| Schneiden | 16 | 20 |
| Schneiden (Seiten 0 mm mit Übergang) | 19 | 30 |
| Waschen, Schneiden, Styling | 19 | 30 |
| Haare Nassrasur | 19 | 30 |
| Bart mit Übergang | 14 | 20 |
| Bart Kontur | 10 | 10 |
| Bart Rasur | 14 | 20 |
| Bart Farbe | 14 | 15 |
| Musterrasur (pro Seite) | ab 14 | 15 |
| Linienrasur | ab 1,50 | 10 |

#### Dauerhafte Umformung
| Service | Price | Proposed duration |
|---|---|---|
| Dauerwelle | ab 40 | 60 |

#### Farbe und Tönung
| Service | Price | Proposed duration |
|---|---|---|
| Tönung | ab 10 | 30 |
| Farbe | 31 | 45 |
| Farbe, Schneiden, Styling | ab 36 | 60 |
| Farbe bei längeren Haaren (Aufschlag) | +5 _(modifier)_ | +15 |

#### Chemische Glättung
| Service | Price | Proposed duration |
|---|---|---|
| Glättung | ab 27 | 45 |

#### Jungs bis 10 Jahre _(Schneiden)_
| Service | Price | Proposed duration |
|---|---|---|
| Schneiden | 13 | 20 |

### Kosmetik & Erweiterungen _(gender = WOMEN; performed by the **female barbers** — confirmed 2026-06-04)_

#### Make-up / Kosmetik
| Service | Price | Proposed duration |
|---|---|---|
| Tages Make-up | ab 25 | 30 |
| Abend Make-up | ab 45 | 45 |
| Augenbrauen Farbe | 8 | 10 |
| Wimpern Farbe | 8 | 10 |
| Zupfen | 8 | 10 |
| Konturierung | 7 | 10 |

#### Haarverlängerungen / Haarverdichtung
| Service | Price | Proposed duration |
|---|---|---|
| 1 Tape (Paar) | 20 | 15 |
| 4 Tape (Paar) | 80 | 45 |
| 20 Tape (Paar) | 400 | 120 |
| Ab 20 Tape (Paar) | **Auf Anfrage** (ON_REQUEST) | enquire only |

> **Modifiers/surcharges** ("Aufschlag +5€", "pro Seite", "pro 2 Cm") aren't standalone bookings. v1 simplest handling: bake into the relevant variant or expose as a checkbox add-on. **Decision pending (§17).**

---

## 10. Reviews

**Goal:** customers see each barber's ★ rating and recent comments when choosing in Step 3.

- **Creation (verified):** after an appointment is marked **COMPLETED**, the customer gets a "leave a review" email using `reviewToken` (reuses the email system). They rate 1–5 + optional comment — **no account needed**, and it's tied to a real visit.
- **Moderation:** new reviews land as **PENDING**; admin **publishes / hides / deletes**. (Or auto-publish — policy pending §17.)
- **Display:** barber profile/card shows `avgRating`, `reviewCount`, and recent PUBLISHED comments with `displayName` (first name + initial, per policy).
- **Seeding:** admin can add a handful of initial reviews so profiles aren't empty at launch.

---

## 11. Admin panel (`/admin`, magic-link login)

- **Dashboard** — today's & upcoming appointments; quick stats (count, gaps).
- **Calendar / agenda** — day & week views, **per-barber columns**; click an appointment to view/edit/cancel/mark COMPLETED/NO_SHOW; **create walk-in / phone booking**; **block time** (TimeOff).
- **Services** — CRUD on categories, services, and **variants** (label, price, priceType, **duration**, add-on flag, active, order); assign which barbers perform each.
- **Barbers** — CRUD (name, gender, bio, photo, active, order); set **weekly working hours**; add **time off**; assign services.
- **Reviews** — list + publish / hide / delete; add seed reviews.
- **Customers** _(optional)_ — list + per-email booking history.
- **Settings** — timezone, opening hours, slot granularity, default buffer, booking window, lead time, cancellation cutoff, shop contact.

---

## 12. Pages / screens list

**Customer (public)**
- `/` — landing (brand, intro, "Book now", QR-friendly).
- `/book` — the wizard (steps 1–5, §7).
- `/book/confirmation` — summary + add-to-calendar.
- `/booking/[manageToken]` — manage (view / cancel / reschedule).
- `/review/[reviewToken]` — leave a review.
- `/barbers` _(optional)_ — meet-the-team + reviews.
- `/prices` _(optional)_ — public price list.

**Admin (protected)**
- `/admin/login`, `/admin` (dashboard), `/admin/calendar`, `/admin/services`, `/admin/barbers`, `/admin/reviews`, `/admin/customers`, `/admin/settings`.

---

## 13. Transactional emails (Resend)

The only emails in v1 — **not** a reminder/marketing system (that's v2):
1. _(Admin login uses email + password — no email involved.)_
2. **Booking confirmation** (to customer) — details + **manage/cancel link** (+ .ics attachment).
3. **Cancellation confirmation** _(optional)_.
4. **Review request** — sent when an appointment is marked COMPLETED.

All German by default; structured for translation.

---

## 14. Ease-of-use principles

- **No account, no password** — name/email/phone only.
- **Mobile-first**, large tap targets, minimal typing.
- **Sticky running total** (time + price) while picking services.
- **"Earliest available"** shortcut for customers without a barber preference.
- **Progress indicator**; back-navigation never loses selections.
- **Clear durations & prices**; "from/ab" prices explicitly labelled.
- **Fast slot loading**; full days clearly disabled.
- Confirmation gives a self-service **manage link** + **add-to-calendar**.
- All times shown in **Munich time**, stated explicitly.

---

## 15. Configuration & settings

| Setting | Proposed default | Notes |
|---|---|---|
| Timezone | `Europe/Berlin` | Confirm |
| Currency / locale | EUR / `de-DE` | |
| Slot granularity | **15 min** | Grid for offered start times |
| Default cleanup buffer | **0 min** (per-service override) | Time between appointments |
| Booking window | **60 days** ahead | How far out bookings open |
| Minimum lead time | **2 hours** | Can't book right before now |
| Cancellation cutoff | **2 hours** before | Inside it → "call the shop" |
| Opening hours | TBD | Per-barber hours are the real source of truth |
| Languages | German (default); English (planned) | Others TBD |

---

## 16. Build order / milestones

1. **M0 — Setup:** Next.js + TS + Tailwind + shadcn, Prisma + Postgres, Auth.js magic-link, Resend, base layout, i18n scaffold.
2. **M1 — Data & seed:** schema + migrations; exclusion constraint; seed the full menu (§9), categories, the 5 barbers, sample working hours.
3. **M2 — Admin core:** magic-link login; manage services/variants & barbers/working hours/time off; service↔barber assignment.
4. **M3 — Slot engine (build + unit tests first):** the riskiest piece — duration math, free-window computation, "any barber" merge, lead/window filters.
5. **M4 — Booking flow:** wizard (steps 1–5), create appointment (transaction + constraint), confirmation page, confirmation email + manage link, .ics.
6. **M5 — Manage & admin bookings:** customer cancel/reschedule; admin calendar, edit, walk-in entry, status changes, time blocking.
7. **M6 — Reviews:** review-request email, submit page, barber rating display, moderation.
8. **M7 — Polish & deploy:** mobile pass, empty/error states, edge cases, Vercel + hosted Postgres, custom domain, QR to `/book`.

---

## 17. Open questions / info still needed

1. **Durations** — ✅ **RESOLVED (2026-06-04):** use the §9 estimates for v1; the shop refines exact minutes later in the admin panel.
2. **Barbers** — names/photos/bios: ✅ **placeholders for v1** (real details + pictures added later via admin). **Mapping ✅ RESOLVED (2026-06-04):** male barbers → all **Herren** services + **Jungs bis 10** (boys); female barbers → all **Damen** services + **Mädchen bis 10** (girls) + **Kosmetik/Make-up** + **Haarverlängerung**. ⏳ Still needed: each barber's **weekly working hours**.
3. **Length variants** — should the customer always pick K/M/L, or default to "Mittel" with stylist confirming? How to phrase "not sure"?
4. **"Ab/from" & "Auf Anfrage"** — show "from" price and book normally? Make ON_REQUEST items "Enquire" (no online booking)?
5. **Modifiers/surcharges** ("Aufschlag +5€", "pro Seite") — bake into variants, or expose as add-on checkboxes?
6. **Add-ons** — which short items (Conditioner, Pony, Bart Kontur, Augenbrauen…) are bookable **only** alongside a main service vs standalone?
7. **Booking rules** — confirm booking window / lead time / cancellation cutoff / buffer (§15 defaults).
8. **Reviews policy** — auto-publish or admin-approve? Full name or first name + initial?
9. **Languages** — German only for v1, or German + English at launch?
10. **Shop details** — address, opening hours, logo, brand colors.
11. **Domain & hosting** — existing domain? OK with Vercel + Neon/Supabase?
12. **Walk-ins** — online booking for appointments only, walk-ins handled in person (admin entry)? (Assumed yes.)

---

## 18. Out of scope for v1 / future (v2+)

- Online payment / deposits (v1 = pay in shop).
- SMS notifications & **appointment reminders** (email infra will already exist → easy add).
- **Stylist logins** (each barber sees/manages only their own day).
- Loyalty, promotions, gift cards, marketing emails.
- Multiple locations.
- Google/Apple Calendar two-way sync.
- Analytics/reporting (revenue, utilization, popular services).
- Recurring/standing appointments.
