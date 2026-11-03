import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma's pg adapter sends DateTimes as offset-less UTC wall-clock strings, so
// Postgres interprets them in the *session* timezone. On a server whose zone
// isn't UTC (e.g. a local Mac in Europe/Berlin) every stored instant was off by
// 1–2 h while reading back looked fine. Pinning each session to UTC makes the
// stored data correct everywhere. We SET it after connect instead of passing a
// startup `options` param, which managed poolers (Neon/Supabase) may reject.
export function createDbAdapter(connectionString = process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString });
  pool.on("connect", (client) => {
    // Queued before any Prisma query on this client, so it always runs first.
    client.query("SET TIME ZONE 'UTC'").catch((e) => {
      console.error("could not set session timezone to UTC:", e);
    });
  });
  return new PrismaPg(pool);
}
