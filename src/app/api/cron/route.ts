import { timingSafeEqual } from "node:crypto";
import { runCron } from "@/lib/cron";

export const dynamic = "force-dynamic";

// Called hourly by netlify/functions/cron.mjs. Protected by a shared secret
// (CRON_SECRET, or AUTH_SECRET which is already set) so it can't be spammed.
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runCron());
}
