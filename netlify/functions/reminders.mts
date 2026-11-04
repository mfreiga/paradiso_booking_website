// Netlify scheduled function: every hour, ask the site to send the
// day-before reminder emails. Runs only on the published production deploy
// (Netlify → Functions → "reminders" has a "Run now" button for testing).
// Needs the CRON_SECRET environment variable (same value the site checks).
export default async function reminders() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("reminders: URL or CRON_SECRET missing");
    return;
  }
  const res = await fetch(`${base}/api/cron/reminders`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  console.log("reminders:", res.status, await res.text());
}

export const config = { schedule: "@hourly" };
