// Transactional email. In dev (no RESEND_API_KEY) it logs to the server
// console; once a key is set it sends via Resend. See SPEC §13.
const FROM = process.env.EMAIL_FROM ?? "Paradiso <onboarding@resend.dev>";

const longDateTime = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});
const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export interface BookingEmailData {
  to: string;
  customerName: string;
  barberName: string;
  startAt: Date;
  services: string[];
  totalPriceCents: number;
  priceIsFrom: boolean;
  manageUrl: string;
}

export function renderBookingConfirmationHtml(d: BookingEmailData): string {
  const when = `${longDateTime.format(d.startAt)} Uhr`;
  const price = `${d.priceIsFrom ? "ab " : ""}${eur.format(d.totalPriceCents / 100)}`;
  return `<!doctype html>
<html lang="de"><body style="margin:0;background:#fafafa;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171717">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <p style="letter-spacing:.2em;text-transform:uppercase;color:#ea580c;font-size:12px;font-weight:600;margin:0">Hairstyling</p>
    <h1 style="margin:4px 0 16px;font-size:24px">Paradiso</h1>
    <p>Hallo ${d.customerName},</p>
    <p>dein Termin ist bestätigt – wir freuen uns auf dich!</p>
    <div style="border:1px solid #e5e5e5;border-radius:12px;padding:16px;background:#fff;margin:16px 0">
      <p style="margin:0 0 4px"><strong>${d.services.join(", ")}</strong></p>
      <p style="margin:0;color:#525252">${d.barberName} · ${when}</p>
      <p style="margin:4px 0 0">${price} · Zahlung vor Ort</p>
    </div>
    <p>
      <a href="${d.manageUrl}" style="display:inline-block;background:#ea580c;color:#fff;padding:11px 20px;border-radius:9999px;text-decoration:none;font-weight:600">Termin ansehen oder stornieren</a>
    </p>
    <p style="color:#737373;font-size:12px;margin-top:24px">Falls du diesen Termin nicht gebucht hast, kannst du diese E-Mail ignorieren.</p>
  </div>
</body></html>`;
}

export async function sendBookingConfirmation(d: BookingEmailData): Promise<void> {
  const subject = "Dein Termin bei Paradiso";
  const html = renderBookingConfirmationHtml(d);
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    // Dev: no Resend key yet — log instead of sending so the flow is testable.
    console.log(
      `\n===== 📧 BOOKING CONFIRMATION (dev — not actually sent) =====\n` +
        `To:      ${d.to}\nSubject: ${subject}\nManage:  ${d.manageUrl}\n` +
        `============================================================\n`,
    );
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  await resend.emails.send({ from: FROM, to: d.to, subject, html });
}

export interface ReviewRequestData {
  to: string;
  customerName: string;
  barberName: string;
  reviewUrl: string;
}

export async function sendReviewRequest(d: ReviewRequestData): Promise<void> {
  const subject = "Wie war dein Besuch bei Paradiso?";
  const html = `<!doctype html>
<html lang="de"><body style="margin:0;background:#fafafa;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171717">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <p style="letter-spacing:.2em;text-transform:uppercase;color:#ea580c;font-size:12px;font-weight:600;margin:0">Hairstyling</p>
    <h1 style="margin:4px 0 16px;font-size:24px">Paradiso</h1>
    <p>Hallo ${d.customerName},</p>
    <p>danke für deinen Besuch bei ${d.barberName}! Wie war's? Über eine kurze Bewertung freuen wir uns sehr.</p>
    <p><a href="${d.reviewUrl}" style="display:inline-block;background:#ea580c;color:#fff;padding:11px 20px;border-radius:9999px;text-decoration:none;font-weight:600">Jetzt bewerten</a></p>
  </div>
</body></html>`;
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.log(
      `\n===== ⭐ REVIEW REQUEST (dev — not actually sent) =====\n` +
        `To:     ${d.to}\nReview: ${d.reviewUrl}\n` +
        `======================================================\n`,
    );
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  await resend.emails.send({ from: FROM, to: d.to, subject, html });
}
