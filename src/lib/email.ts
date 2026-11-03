// Transactional email. Sends via Resend (RESEND_API_KEY) or any SMTP server
// (SMTP_URL, e.g. a Gmail account with an app password). With neither set it
// only logs, so the booking flow keeps working in dev.
import type { Locale } from "./i18n";
import { tName } from "./service-i18n";

const FROM = process.env.EMAIL_FROM ?? "Hairstyling Paradiso <onboarding@resend.dev>";
const TZ = "Europe/Berlin";
const SHOP = { name: "Hairstyling Paradiso", address: "Augustenstraße 72, 80333 München" };

// Customers type their own name AND choose the recipient address, so every
// interpolated value must be escaped or the form becomes an HTML-mail relay.
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Attachment {
  filename: string;
  content: string;
  contentType: string;
}

interface Message {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
}

/** Which transport is configured — shown in logs so a missing setup is obvious. */
export function emailTransport(): "resend" | "smtp" | "log" {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_URL) return "smtp";
  return "log";
}

async function deliver(m: Message): Promise<void> {
  const to = Array.isArray(m.to) ? m.to : [m.to];
  if (to.length === 0) return;

  switch (emailTransport()) {
    case "resend": {
      const { Resend } = await import("resend");
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: FROM,
        to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        replyTo: m.replyTo,
        attachments: m.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content),
          contentType: a.contentType,
        })),
      });
      if (error) throw new Error(`Resend: ${error.message}`);
      return;
    }
    case "smtp": {
      const nodemailer = await import("nodemailer");
      await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
        from: FROM,
        to,
        subject: m.subject,
        html: m.html,
        text: m.text,
        replyTo: m.replyTo,
        attachments: m.attachments,
      });
      return;
    }
    default:
      console.log(
        `\n===== 📧 EMAIL (not sent: no RESEND_API_KEY or SMTP_URL) =====\n` +
          `To:      ${to.join(", ")}\nSubject: ${m.subject}\n\n${m.text}\n` +
          `==============================================================\n`,
      );
  }
}

/** Shop inbox for new-booking / cancellation alerts. Placeholder *.test addresses are ignored. */
function shopRecipients(): string[] {
  const raw = process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@") && !s.endsWith(".test"));
}

// ── formatting ─────────────────────────────────────────────────────────────
const loc = (l: Locale) => (l === "en" ? "en-GB" : "de-DE");
const fmtDay = (d: Date, l: Locale) =>
  new Intl.DateTimeFormat(loc(l), { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(d);
const fmtShortDay = (d: Date) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ }).format(d);
const fmtTime = (d: Date, l: Locale) =>
  new Intl.DateTimeFormat(loc(l), { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
const fmtPrice = (cents: number, l: Locale) =>
  new Intl.NumberFormat(loc(l), { style: "currency", currency: "EUR" }).format(cents / 100);
const clock = (d: Date, l: Locale) => (l === "de" ? `${fmtTime(d, l)} Uhr` : fmtTime(d, l));

// ── shared layout ──────────────────────────────────────────────────────────
function button(href: string, label: string, primary = true) {
  const style = primary
    ? "background:#ea580c;color:#fff"
    : "background:#fff;color:#171717;border:1px solid #d4d4d4";
  return `<a href="${esc(href)}" style="display:inline-block;${style};padding:11px 20px;border-radius:9999px;text-decoration:none;font-weight:600;margin:0 8px 8px 0">${esc(label)}</a>`;
}

function layout(lang: Locale, body: string, footer: string) {
  return `<!doctype html>
<html lang="${lang}"><body style="margin:0;background:#fafafa;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171717;line-height:1.5">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <p style="letter-spacing:.2em;text-transform:uppercase;color:#ea580c;font-size:12px;font-weight:600;margin:0">Hairstyling</p>
    <h1 style="margin:4px 0 20px;font-size:24px">Paradiso</h1>
    ${body}
    <p style="color:#737373;font-size:12px;margin-top:28px;border-top:1px solid #e5e5e5;padding-top:12px">${footer}</p>
  </div>
</body></html>`;
}

function detailsBox(lines: string[]) {
  const [first, ...rest] = lines;
  return `<div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;background:#fff;margin:16px 0">
      <p style="margin:0 0 4px"><strong>${first}</strong></p>
      ${rest.map((l) => `<p style="margin:2px 0;color:#525252">${l}</p>`).join("\n      ")}
    </div>`;
}

// ── booking confirmation (customer) + alert (shop) ─────────────────────────
export interface BookingEmailData {
  to: string;
  locale: Locale;
  customerName: string;
  customerPhone?: string;
  note?: string;
  barberName: string;
  startAt: Date;
  durationMinutes: number;
  /** Stored (German) service names; translated here for the customer. */
  services: string[];
  totalPriceCents: number;
  priceIsFrom: boolean;
  manageUrl: string;
  calendarUrl: string;
  /** .ics file content, attached so mail apps offer "add to calendar". */
  ics: string;
  shopPhone: string;
  cancelCutoffHours: number;
  adminUrl: string;
  /** false for bookings the salon entered itself (no point alerting them). */
  notifyShop?: boolean;
}

export function renderBookingConfirmation(d: BookingEmailData) {
  const l = d.locale;
  const services = d.services.map((s) => tName(s, l)).join(", ");
  const price = `${d.priceIsFrom ? (l === "de" ? "ab " : "from ") : ""}${fmtPrice(d.totalPriceCents, l)}`;
  const day = fmtDay(d.startAt, l);
  const time = clock(d.startAt, l);

  if (l === "en") {
    const subject = `Your appointment on ${day} at ${time}`;
    const html = layout(
      "en",
      `<p>Hi ${esc(d.customerName)},</p>
    <p>thanks for booking. See you soon!</p>
    ${detailsBox([esc(services), `${esc(day)}, ${time}`, `with ${esc(d.barberName)} · about ${d.durationMinutes} min`, `${price} · pay at the salon (cash or card)`])}
    <p>${button(d.calendarUrl, "Add to calendar")}${button(d.manageUrl, "View or cancel", false)}</p>
    <p style="font-size:14px;color:#525252">You can cancel online up to ${d.cancelCutoffHours} hours before. After that, just give us a call: ${esc(d.shopPhone)}.</p>`,
      `${SHOP.name} · ${SHOP.address}<br>Didn't book this? Then you can ignore this email.`,
    );
    const text = `Hi ${d.customerName},

thanks for booking. Here are the details:

${services}
${day}, ${time}
with ${d.barberName} · about ${d.durationMinutes} min
${price} · pay at the salon (cash or card)

View or cancel: ${d.manageUrl}
Add to calendar: ${d.calendarUrl}

You can cancel online up to ${d.cancelCutoffHours} hours before. After that, please call us: ${d.shopPhone}.

${SHOP.name}, ${SHOP.address}`;
    return { subject, html, text };
  }

  const subject = `Dein Termin am ${day} um ${time}`;
  const html = layout(
    "de",
    `<p>Hallo ${esc(d.customerName)},</p>
    <p>danke für deine Buchung. Bis bald!</p>
    ${detailsBox([esc(services), `${esc(day)}, ${time}`, `bei ${esc(d.barberName)} · ca. ${d.durationMinutes} Min.`, `${price} · Zahlung im Salon (bar oder Karte)`])}
    <p>${button(d.calendarUrl, "In den Kalender eintragen")}${button(d.manageUrl, "Termin ansehen oder absagen", false)}</p>
    <p style="font-size:14px;color:#525252">Absagen kannst du online bis ${d.cancelCutoffHours} Stunden vorher. Danach ruf uns bitte kurz an: ${esc(d.shopPhone)}.</p>`,
    `${SHOP.name} · ${SHOP.address}<br>Du hast nichts gebucht? Dann kannst du diese E-Mail einfach ignorieren.`,
  );
  const text = `Hallo ${d.customerName},

danke für deine Buchung. Hier die Details:

${services}
${day}, ${time}
bei ${d.barberName} · ca. ${d.durationMinutes} Min.
${price} · Zahlung im Salon (bar oder Karte)

Ansehen oder absagen: ${d.manageUrl}
In den Kalender eintragen: ${d.calendarUrl}

Absagen kannst du online bis ${d.cancelCutoffHours} Stunden vorher. Danach ruf uns bitte an: ${d.shopPhone}.

${SHOP.name}, ${SHOP.address}`;
  return { subject, html, text };
}

/** The shop's heads-up (always German — it's for the owner). */
export function renderShopNewBooking(d: BookingEmailData) {
  const services = d.services.join(", ");
  const subject = `Neue Buchung: ${fmtShortDay(d.startAt)} ${fmtTime(d.startAt, "de")} · ${d.barberName} · ${d.customerName}`;
  const contact = [d.to, d.customerPhone].filter(Boolean).join(" · ");
  const html = layout(
    "de",
    `<p>Gerade wurde online gebucht:</p>
    ${detailsBox([
      `${esc(fmtDay(d.startAt, "de"))}, ${clock(d.startAt, "de")}`,
      `${esc(d.barberName)} · ${esc(services)} · ca. ${d.durationMinutes} Min.`,
      `${esc(d.customerName)} · ${esc(contact)}`,
      ...(d.note ? [`Anmerkung: „${esc(d.note)}“`] : []),
    ])}
    <p>${button(d.adminUrl, "Im Adminbereich öffnen")}</p>`,
    `${SHOP.name} · automatische Nachricht der Website`,
  );
  const text = `Gerade wurde online gebucht:

${fmtDay(d.startAt, "de")}, ${clock(d.startAt, "de")}
${d.barberName} · ${services} · ca. ${d.durationMinutes} Min.
${d.customerName} · ${contact}${d.note ? `\nAnmerkung: „${d.note}“` : ""}

Adminbereich: ${d.adminUrl}`;
  return { subject, html, text };
}

export async function sendBookingConfirmation(d: BookingEmailData): Promise<void> {
  const customer = renderBookingConfirmation(d);
  const shop = shopRecipients();
  await Promise.all([
    deliver({
      to: d.to,
      ...customer,
      replyTo: shop[0],
      attachments: [{ filename: "paradiso-termin.ics", content: d.ics, contentType: "text/calendar; charset=utf-8; method=PUBLISH" }],
    }),
    shop.length && d.notifyShop !== false
      ? deliver({ to: shop, ...renderShopNewBooking(d), replyTo: d.to })
      : Promise.resolve(),
  ]);
}

// ── cancellation ───────────────────────────────────────────────────────────
export interface CancellationEmailData {
  to: string;
  locale: Locale;
  customerName: string;
  barberName: string;
  startAt: Date;
  services: string[];
  bookUrl: string;
  /** Who cancelled — the customer online, or the salon in the admin area. */
  by: "customer" | "shop";
}

export function renderCancellation(d: CancellationEmailData) {
  const l = d.locale;
  const services = d.services.map((s) => tName(s, l)).join(", ");
  const when = `${fmtDay(d.startAt, l)}, ${clock(d.startAt, l)}`;
  if (l === "en") {
    const intro =
      d.by === "shop"
        ? "unfortunately we had to cancel your appointment. Sorry about that! Feel free to book a new time or give us a call."
        : "your appointment has been cancelled.";
    return {
      subject: "Your appointment has been cancelled",
      html: layout("en", `<p>Hi ${esc(d.customerName)},</p><p>${intro}</p>${detailsBox([esc(services), esc(when), `with ${esc(d.barberName)}`])}<p>${button(d.bookUrl, "Book a new appointment")}</p>`, `${SHOP.name} · ${SHOP.address}`),
      text: `Hi ${d.customerName},\n\n${intro}\n\n${services}\n${when}\nwith ${d.barberName}\n\nBook a new appointment: ${d.bookUrl}`,
    };
  }
  const intro =
    d.by === "shop"
      ? "leider mussten wir deinen Termin absagen. Tut uns leid! Buch dir gern einen neuen oder ruf uns kurz an."
      : "dein Termin ist abgesagt.";
  return {
    subject: "Dein Termin wurde abgesagt",
    html: layout("de", `<p>Hallo ${esc(d.customerName)},</p><p>${intro}</p>${detailsBox([esc(services), esc(when), `bei ${esc(d.barberName)}`])}<p>${button(d.bookUrl, "Neuen Termin buchen")}</p>`, `${SHOP.name} · ${SHOP.address}`),
    text: `Hallo ${d.customerName},\n\n${intro}\n\n${services}\n${when}\nbei ${d.barberName}\n\nNeuen Termin buchen: ${d.bookUrl}`,
  };
}

export async function sendCancellation(d: CancellationEmailData): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (d.to) jobs.push(deliver({ to: d.to, ...renderCancellation(d), replyTo: shopRecipients()[0] }));
  const shop = shopRecipients();
  if (d.by === "customer" && shop.length) {
    const when = `${fmtShortDay(d.startAt)} ${fmtTime(d.startAt, "de")}`;
    jobs.push(
      deliver({
        to: shop,
        subject: `Abgesagt: ${when} · ${d.barberName} · ${d.customerName}`,
        html: layout("de", `<p>${esc(d.customerName)} hat online abgesagt:</p>${detailsBox([`${esc(fmtDay(d.startAt, "de"))}, ${clock(d.startAt, "de")}`, `${esc(d.barberName)} · ${esc(d.services.join(", "))}`])}<p>Die Zeit ist wieder frei.</p>`, `${SHOP.name} · automatische Nachricht der Website`),
        text: `${d.customerName} hat online abgesagt:\n\n${fmtDay(d.startAt, "de")}, ${clock(d.startAt, "de")}\n${d.barberName} · ${d.services.join(", ")}\n\nDie Zeit ist wieder frei.`,
      }),
    );
  }
  await Promise.all(jobs);
}

// ── review request ─────────────────────────────────────────────────────────
export interface ReviewRequestData {
  to: string;
  locale?: Locale;
  customerName: string;
  barberName: string;
  reviewUrl: string;
}

export async function sendReviewRequest(d: ReviewRequestData): Promise<void> {
  const en = d.locale === "en";
  const intro = en
    ? `thanks for coming in to see ${d.barberName}! How did it go? A quick rating would help us a lot.`
    : `danke für deinen Besuch bei ${d.barberName}! Wie war's? Eine kurze Bewertung hilft uns sehr.`;
  await deliver({
    to: d.to,
    subject: en ? "How was your visit at Paradiso?" : "Wie war dein Besuch bei Paradiso?",
    html: layout(en ? "en" : "de", `<p>${en ? "Hi" : "Hallo"} ${esc(d.customerName)},</p><p>${esc(intro)}</p><p>${button(d.reviewUrl, en ? "Leave a rating" : "Jetzt bewerten")}</p>`, `${SHOP.name} · ${SHOP.address}`),
    text: `${en ? "Hi" : "Hallo"} ${d.customerName},\n\n${intro}\n\n${d.reviewUrl}`,
  });
}
