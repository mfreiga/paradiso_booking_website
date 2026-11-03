// Web push to the owner's devices (new bookings, cancellations). The VAPID
// key pair is generated on first use and kept in the Setting row, so no env
// configuration is needed. Payloads are end-to-end encrypted by the protocol.
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";

export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const s = await prisma.setting.findUnique({ where: { id: 1 }, select: { vapidPublicKey: true, vapidPrivateKey: true } });
  if (s?.vapidPublicKey && s.vapidPrivateKey) return { publicKey: s.vapidPublicKey, privateKey: s.vapidPrivateKey };

  const keys = webpush.generateVAPIDKeys();
  // Only fills empty keys, so two concurrent first calls can't end up with different pairs.
  await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey },
    update: {},
  });
  await prisma.setting.updateMany({
    where: { id: 1, vapidPublicKey: null },
    data: { vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey },
  });
  const saved = await prisma.setting.findUniqueOrThrow({ where: { id: 1 }, select: { vapidPublicKey: true, vapidPrivateKey: true } });
  return { publicKey: saved.vapidPublicKey!, privateKey: saved.vapidPrivateKey! };
}

export interface PushMessage {
  title: string;
  body: string;
  /** Path opened when the notification is tapped. */
  url?: string;
}

/** Sends to every registered admin device. Never throws. */
export async function notifyShop(msg: PushMessage): Promise<void> {
  try {
    const subs = await prisma.pushSubscription.findMany();
    if (subs.length === 0) return;
    const { publicKey, privateKey } = await getVapidKeys();
    const contact = (process.env.NOTIFY_EMAIL ?? "").split(",")[0]?.trim();
    webpush.setVapidDetails(contact ? `mailto:${contact}` : siteUrl(), publicKey, privateKey);
    const payload = JSON.stringify({ ...msg, url: msg.url ?? "/admin" });

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // Gone / not found = the device unsubscribed or the app was removed.
          if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          else console.error("push failed:", status ?? e);
        }
      }),
    );
  } catch (e) {
    console.error("notifyShop failed:", e);
  }
}
