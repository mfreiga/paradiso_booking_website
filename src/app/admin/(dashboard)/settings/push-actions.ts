"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { notifyShop } from "@/lib/push";

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, label: string) {
  await requireAdmin();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false as const };
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: label.slice(0, 100) },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: label.slice(0, 100) },
  });
  revalidatePath("/admin/settings");
  return { ok: true as const };
}

export async function removePushSubscription(endpoint: string) {
  await requireAdmin();
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  revalidatePath("/admin/settings");
}

export async function sendTestPush() {
  await requireAdmin();
  await notifyShop({ title: "Paradiso", body: "Test: Benachrichtigungen funktionieren.", url: "/admin" });
}
