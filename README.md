# Hairstyling Paradiso — Online-Terminbuchung

Buchungs-Website für den Friseursalon **Hairstyling Paradiso** (München).
Kund:innen wählen Leistung(en), Friseur:in und Zeit; eine Slot-Engine berechnet
die freien Termine auf Basis der echten Arbeitszeiten und bestehenden Buchungen
(Dauer der Leistung bestimmt die Slot-Länge). Inklusive Adminbereich
(Leistungen, Friseure & Arbeitszeiten, Termine, Wochen-Kalender, Bewertungen,
Walk-in-Erfassung) und Bewertungs-Workflow.

## Tech-Stack
- **Next.js 16** (App Router, React 19, TypeScript)
- **Tailwind CSS v4**
- **PostgreSQL** + **Prisma 7** (Driver-Adapter `@prisma/adapter-pg`; lokal via Docker)
- **Auth.js** — Admin-Login (E-Mail + Passwort)
- **Resend** — transaktionale E-Mails (Bestätigung, Bewertungs-Anfrage)
- **Vitest** — Tests der Slot-Engine

## Lokal starten

```bash
# 1. Datenbank (Postgres via Docker)
docker compose up -d --wait

# 2. Abhängigkeiten installieren (generiert auch den Prisma-Client)
npm install

# 3. Schema anlegen + Beispieldaten laden
npx prisma migrate dev
npm run db:seed                # Menü, Friseure, Beispiel-Bewertungen
npm run db:seed:appointments   # optionale Beispieltermine

# 4. Entwicklungsserver
npm run dev                    # http://localhost:3000  ·  Admin: /admin/login
```

Umgebungsvariablen: `.env.example` nach `.env` kopieren und ausfüllen.

## Tests

```bash
npm test
```

## Projektstruktur (Auszug)
- `prisma/` — Schema, Migrationen, Seed-Skripte
- `src/lib/slots.ts` — reine Slot-Berechnung (getestet) · `src/lib/availability.ts` — DB-Anbindung
- `src/app/book` — Kunden-Buchungsablauf · `src/app/booking/[token]` — Termin verwalten/stornieren
- `src/app/admin` — Adminbereich · `src/app/review/[token]` — Bewertung abgeben

Die vollständige Spezifikation steht in [`SPEC.md`](./SPEC.md).

---

_Entwickelt mit Unterstützung von **Claude (Anthropic), Modell: Opus**._
