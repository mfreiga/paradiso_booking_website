# Launch guide — Hairstyling Paradiso

Everything that has to be set up **outside the code** so the site runs for real.
Code-side everything is done; this is accounts, settings and DNS.
Order matters: 1 → 6.

---

## 1. Hosting (Netlify) and database (Neon)

The site runs on **Netlify**, the data lives in **Neon** (Postgres, Frankfurt).
Nothing runs on anyone's laptop: barbers just open the website / app.

Every push to `main` deploys automatically. The build command is
`npx prisma migrate deploy && npm run build` (see `netlify.toml`): **database
migrations run first**. If a migration fails, the build stops and the previous
version stays online — code and database can't get out of step any more.

**Netlify → Site configuration → Environment variables** (scope: *Builds* and *Functions*):

| Variable | Value | Why |
|---|---|---|
| `DATABASE_URL` | Neon connection string (pooled, host contains `-pooler`) | the app's database |
| `DIRECT_DATABASE_URL` | Neon connection string **without** `-pooler` (Neon → Connection details → uncheck "Connection pooling") | migrations during the build |
| `AUTH_SECRET` | `openssl rand -base64 33` | signs the admin logins |
| `ADMIN_EMAILS` | Bassam's email | owner master login (always works) |
| `ADMIN_PASSWORD` | long random password, ≥ 16 characters | owner master login |
| `SITE_URL` | `https://www.<your-domain>` (later) — until then leave empty | links in emails; empty = Netlify address |
| `SHOP_TIMEZONE` | `Europe/Berlin` | |
| `CRON_SECRET` | `openssl rand -hex 32` | protects the hourly job (reminders, review mails, data cleanup) |
| `SMTP_URL` **or** `RESEND_API_KEY` | see section 3 | sending email |
| `EMAIL_FROM` | see section 3 | sender name/address |
| `NOTIFY_EMAIL` | Bassam's inbox (comma-separated for several) | "new booking" / "cancelled" alerts |

After changing variables: **Deploys → Trigger deploy → Deploy site**.

> Note: `hairstylingparadiso.netlify.app` currently still shows the old static
> price list. The Netlify site connected to this GitHub repo is the one to use.

---

## 2. Domain

Free at the moment (checked 05.11.2026 at DENIC):

- **hairstylingparadiso.de** ← recommended (matches the Google name)
- paradiso-muenchen.de · paradiso-friseur.de · paradiso-maxvorstadt.de

Already registered: **hairstyling-paradiso.de** and **friseur-paradiso.de** (the
second forwards to the first; both show a server error). **Ask Bassam whether
these are his** (old website?) — if yes, use hairstyling-paradiso.de.

Steps (any German registrar, ~1 €/month for .de, e.g. INWX, IONOS, Strato):

1. Buy the domain in **Bassam's name** (he is the owner of the business).
2. Netlify → Domain management → **Add a domain** → follow the DNS instructions
   (either switch the nameservers to Netlify, or set `A @ 75.2.60.5` and
   `CNAME www <site>.netlify.app` at the registrar). HTTPS is automatic.
3. Set `SITE_URL=https://www.<domain>` and redeploy.
4. Put the new address into the **Google Business profile** (website field),
   Instagram bio, and print a QR code to `/book` for the shop.

Leaving Netlify later is easy: the app is a standard Next.js + Postgres app.
Vercel works the same way (import the repo, copy the env vars, point DNS there);
the data stays in Neon either way, and the domain stays with Bassam's registrar.

---

## 3. Email — which account sends what

| Mail | From | To |
|---|---|---|
| Booking confirmation (+ calendar file), reminder ~24 h before, "moved", "cancelled", review request | the shop sender (`EMAIL_FROM`) | customer |
| "New booking", "Cancelled online" | the shop sender | `NOTIFY_EMAIL` (Bassam) |
| Customer presses *Reply* | — | goes to `NOTIFY_EMAIL` (reply-to is set) |

**Phase 1 — today, no domain needed: a dedicated Gmail**

1. Create a new Gmail account for the salon, e.g. `paradiso.termine@gmail.com`
   (don't use anyone's private mailbox).
2. Turn on 2-step verification → Google account → Security → **App passwords** →
   create one ("Paradiso Website"), 16 letters.
3. On Netlify:
   - `SMTP_URL=smtps://paradiso.termine%40gmail.com:APPPASSWORD@smtp.gmail.com:465`
     (`@` in the user name written as `%40`, app password without spaces)
   - `EMAIL_FROM=Hairstyling Paradiso <paradiso.termine@gmail.com>`
4. Admin → Einstellungen → **Test senden**. Limit: ~500 mails/day (plenty).

**Phase 2 — once the domain exists: Resend (better delivery, own address)**

1. resend.com → account → **Domains → Add** → add the DNS records it shows
   (SPF/DKIM) at the registrar → wait for "Verified".
2. API key → Netlify `RESEND_API_KEY`; `EMAIL_FROM=Hairstyling Paradiso <termine@<domain>>`;
   remove `SMTP_URL`. Free tier: 3,000 mails/month.
3. Optional: a real inbox `info@<domain>` at the registrar (or forwarding to Bassam).

---

## 4. Team logins (per barber)

1. Bassam logs in at `/admin` with the master login (`ADMIN_EMAILS` / `ADMIN_PASSWORD`).
2. **Team-Zugänge** → for each barber: choose their calendar, role *Friseur:in*,
   username (e.g. `steven`) → **Zugang anlegen**. The one-time password is shown
   **once** → hand it over in person (or read it out).
3. Also create one for Bassam himself: calendar *Bassam*, role **Inhaber** —
   then he gets his own phone notifications and can change his password.
4. Each person logs in once and sets their own password under **Mein Konto**.

What a barber can do: see **only their own** appointments and calendar, enter
phone/walk-in bookings into their own calendar, block their own time (holiday,
doctor), mark done/no-show, move their own bookings. Bassam gets a phone
notification when a barber blocks time. Prices, services, other barbers, reviews
and settings are owner-only. Locking a login (*Sperren*) takes effect immediately.

## 5. App on the phone + notifications (everyone, 2 minutes)

On the phone: open the website `/admin` → log in → **Mein Konto** → follow the
steps (iPhone: Safari → Share → *Zum Home-Bildschirm*; Android: Chrome → ⋮ →
*App installieren*) → open the new "Paradiso" app → **Benachrichtigungen
einschalten** → *Test senden*.
Barbers get notified about **their own** new/cancelled/moved bookings; the owner
about all of them. (iPhone needs iOS 16.4+ and the app on the Home Screen.)

## 6. Before going live — checklist

- [ ] Impressum: owner's full name, email, USt-IdNr (legally required)
- [ ] Real weekly hours per barber (Admin → Friseure) and service durations
- [ ] Barber photos (Admin → Friseure → Foto hochladen)
- [ ] Test email arrives (Einstellungen → Test senden), also check spam folder
- [ ] One real test booking on the live site → confirmation email + phone push
- [ ] Netlify → Functions → `cron` → **Run now** once (reminder job runs hourly)
- [ ] Google Business profile: website link → booking page

## Cookies / privacy (no banner needed)

The public site sets **one** cookie (`lang`, only after someone taps DE/EN — a
function they asked for, so no consent needed under §25 TTDSG). Admin login
cookies only exist for staff. No analytics, no tracking, fonts are self-hosted,
Google Maps loads only after a click. → **No cookie banner required.** The
Datenschutz page describes all of this, plus email providers, Neon, Netlify and
the 12-month deletion. Have it checked once by someone legal before launch.
