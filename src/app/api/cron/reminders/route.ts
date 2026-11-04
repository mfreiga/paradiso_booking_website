import { timingSafeEqual } from "node:crypto";
import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/** Constant-time compare so the secret can't be guessed by timing. */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Called hourly by the Netlify scheduled function (netlify/functions/reminders.mts). */
export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const result = await sendDueReminders();
  console.log("reminders:", result);
  return Response.json(result);
}
