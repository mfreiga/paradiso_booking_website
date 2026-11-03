// Brute-force lock for the admin login, stored in the DB (serverless instances
// share no memory). Limits failed attempts per email and per IP in a window.
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60_000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 20;

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
}

export async function loginKeys(email: string) {
  return { email: `email:${email.toLowerCase().trim()}`, ip: `ip:${await clientIp()}` };
}

export async function isLocked(keys: { email: string; ip: string }): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: keys.email, createdAt: { gt: since } } }),
    prisma.loginAttempt.count({ where: { key: keys.ip, createdAt: { gt: since } } }),
  ]);
  return byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP;
}

export async function recordFailure(keys: { email: string; ip: string }) {
  await prisma.loginAttempt.createMany({ data: [{ key: keys.email }, { key: keys.ip }] });
}

export async function clearFailures(keys: { email: string }) {
  await prisma.loginAttempt.deleteMany({ where: { key: keys.email } });
}

/** Housekeeping for the hourly job. */
export async function pruneLoginAttempts() {
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
}
