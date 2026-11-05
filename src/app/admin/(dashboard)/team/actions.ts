"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { generatePassword, hashPassword } from "@/lib/password";

export type NewLogin = { ok: true; username: string; password: string } | { ok: false; error: string };

const usernameRe = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Owner creates a login. The one-time password is returned to the page (shown
 * once, never put in a URL or email) and passed on in person; the barber then
 * changes it under "Mein Konto".
 */
export async function createLogin(input: {
  stylistId: string;
  username: string;
  email: string;
  role: "OWNER" | "BARBER";
}): Promise<NewLogin> {
  await requireAdmin();
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase() || null;
  const role = input.role === "OWNER" ? "OWNER" : "BARBER";
  const stylistId = input.stylistId || null;

  if (!usernameRe.test(username)) return { ok: false, error: "Benutzername: 3–30 Zeichen, nur a–z, 0–9, Punkt, Strich." };
  if (email && !emailRe.test(email)) return { ok: false, error: "Die E-Mail-Adresse sieht nicht richtig aus." };
  if (role === "BARBER" && !stylistId) return { ok: false, error: "Ein Friseur-Zugang braucht einen Kalender (Friseur:in wählen)." };

  const clash = await prisma.user.findFirst({
    where: { OR: [{ username }, ...(email ? [{ email }] : []), ...(stylistId ? [{ stylistId }] : [])] },
    select: { username: true, email: true, stylistId: true },
  });
  if (clash?.username === username) return { ok: false, error: "Diesen Benutzernamen gibt es schon." };
  if (email && clash?.email === email) return { ok: false, error: "Diese E-Mail hat schon einen Zugang." };
  if (stylistId && clash?.stylistId === stylistId) return { ok: false, error: "Für diesen Kalender gibt es schon einen Zugang." };

  const stylist = stylistId ? await prisma.stylist.findUnique({ where: { id: stylistId }, select: { name: true } }) : null;
  if (stylistId && !stylist) return { ok: false, error: "Friseur:in nicht gefunden." };

  const password = generatePassword();
  await prisma.user.create({
    data: { username, email, role, stylistId, name: stylist?.name ?? username, passwordHash: await hashPassword(password) },
  });
  revalidatePath("/admin/team");
  return { ok: true, username, password };
}

/** New one-time password (e.g. forgotten). Returned once to the owner's screen. */
export async function resetLoginPassword(userId: string): Promise<NewLogin> {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user?.username) return { ok: false, error: "Zugang nicht gefunden." };
  const password = generatePassword();
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  return { ok: true, username: user.username, password };
}

export async function setLoginActive(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === me.id) return; // never lock yourself out
  await prisma.user.update({ where: { id }, data: { isActive: formData.get("active") === "true" } });
  revalidatePath("/admin/team");
}

export async function deleteLogin(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === me.id) return;
  await prisma.user.delete({ where: { id } }); // their phone subscriptions go with it (cascade)
  revalidatePath("/admin/team");
}
