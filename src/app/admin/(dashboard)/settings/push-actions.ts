"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { notifyUserDevices } from "@/lib/push";

// Phone notifications are per person: a device belongs to whoever switched it
// on (barbers then only get news about their own bookings, see lib/push.ts).
// The shared owner login has no DB row, so its devices are stored without user.
const ownerOf = (s: { isEnvAdmin: boolean; id: string }) => (s.isEnvAdmin ? null : s.id);

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, label: string) {
  const staff = await requireStaff();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false as const };
  const userId = ownerOf(staff);
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    // Re-registering a shared phone moves it to whoever is logged in now.
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: label.slice(0, 100), userId },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: label.slice(0, 100), userId },
  });
  revalidatePath("/admin/account");
  return { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  const staff = await requireStaff();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: ownerOf(staff) } });
  revalidatePath("/admin/account");
}

export async function sendTestPush() {
  const staff = await requireStaff();
  await notifyUserDevices(ownerOf(staff), { title: "Paradiso", body: "Test: Benachrichtigungen funktionieren.", url: "/admin" });
}
