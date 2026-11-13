import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Staff passwords: scrypt (memory-hard, built into Node), random salt per user.
// Stored as "scrypt$<N>$<salt b64>$<hash b64>" so parameters can change later.
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number }) => Promise<Buffer>;
const N = 16384;
const KEY_LEN = 64;

export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN, { N });
  return `scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [kind, n, saltB64, hashB64] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !n || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Readable one-time password for a new/reset account, e.g. "kamm-4827-fade".
 * Shown once to the owner, who passes it on; the barber changes it after logging in.
 */
export function generatePassword(): string {
  const words = ["schere", "kamm", "fade", "bart", "locke", "spiegel", "salon", "fön", "glanz", "welle", "kontur", "schnitt"];
  const pick = () => words[randomInt(words.length)].replace("ö", "oe");
  return `${pick()}-${randomInt(1000, 10000)}-${pick()}`;
}

/** Owner-chosen passwords must be long enough; checked before hashing. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;
  if (pw.length > 200) return "Zu lang.";
  return null;
}
