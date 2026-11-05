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

export interface PushTarget {
  /** Barbers whose devices should also get it (e.g. the booking's barber). */
  stylistIds?: (string | null | undefined)[];
  /** Don't notify the person who did it themselves. */
  excludeUserId?: string;
}

type SubWhere = NonNullable<Parameters<typeof prisma.pushSubscription.findMany>[0]>["where"];

/** Sends `msg` to every subscription matching `where`; prunes dead devices. Never throws. */
async function sendTo(where: SubWhere, msg: PushMessage): Promise<void> {
  try {
    const subs = await prisma.pushSubscription.findMany({ where });
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
    console.error("push send failed:", e);
  }
}

/**
 * Sends to the owner's devices (shared owner login + OWNER accounts) and to
 * the devices of the given barbers. Barbers never get other barbers' news.
 */
export async function notifyStaff(msg: PushMessage, target: PushTarget = {}): Promise<void> {
  const stylistIds = (target.stylistIds ?? []).filter((x): x is string => Boolean(x));
  await sendTo(
    {
      OR: [
        { userId: null },
        { user: { isActive: true, role: { in: ["OWNER", "ADMIN"] } } },
        ...(stylistIds.length ? [{ user: { isActive: true, stylistId: { in: stylistIds } } }] : []),
      ],
      ...(target.excludeUserId ? { NOT: { userId: target.excludeUserId } } : {}),
    },
    msg,
  );
}

/** Owner devices only. */
export const notifyShop = (msg: PushMessage) => notifyStaff(msg);

/** Only one person's own devices (e.g. the "test notification" button). null = shared owner login. */
export async function notifyUserDevices(userId: string | null, msg: PushMessage): Promise<void> {
  await sendTo({ userId }, msg);
}
