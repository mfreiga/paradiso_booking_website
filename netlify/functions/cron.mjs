// Netlify Scheduled Function: once an hour, ask the site to send reminders and
// review requests and to do its housekeeping (see src/lib/cron.ts).
async function runHourly() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET;
  if (!base || !secret) {
    console.error("cron: URL or secret missing");
    return;
  }
  const res = await fetch(`${base}/api/cron`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  console.log("cron:", res.status, await res.text());
}

export default runHourly;

export const config = { schedule: "@hourly" };
