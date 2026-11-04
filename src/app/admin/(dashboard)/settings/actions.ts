"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { emailTransport, sendTestEmail } from "@/lib/email";

const GRANULARITIES = [5, 10, 15, 20, 30, 60];

/** Whole number from a form field, clamped to [min, max]; NaN → fallback. */
function int(formData: FormData, key: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
}

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  const current = await prisma.setting.findUnique({ where: { id: 1 } });
  const phone = String(formData.get("shopPhone") ?? "").trim().slice(0, 40);
  const address = String(formData.get("shopAddress") ?? "").trim().slice(0, 200);
  const granularity = int(formData, "slotGranularityMin", 5, 60, 15);

  const data = {
    shopPhone: phone || current?.shopPhone || "089 57933371",
    shopAddress: address || null,
    bookingWindowDays: int(formData, "bookingWindowDays", 1, 365, 60),
    minLeadTimeMin: int(formData, "minLeadTimeHours", 0, 72, 2) * 60,
    cancellationCutoffMin: int(formData, "cancellationCutoffHours", 0, 72, 2) * 60,
    slotGranularityMin: GRANULARITIES.includes(granularity) ? granularity : 15,
    defaultBufferMin: int(formData, "defaultBufferMin", 0, 60, 0),
  };
  await prisma.setting.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  // Phone/address and booking rules show up across the public site.
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

export async function sendSettingsTestEmail(formData: FormData) {
  const session = await requireAdmin();
  const to = String(formData.get("to") ?? "").trim() || session.user?.email || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) redirect("/admin/settings?test=invalid");
  if (emailTransport() === "log") redirect("/admin/settings?test=nosetup");
  try {
    await sendTestEmail(to);
  } catch (e) {
    console.error("test email failed:", e);
    redirect(`/admin/settings?test=failed&msg=${encodeURIComponent(String((e as Error)?.message ?? e).slice(0, 160))}`);
  }
  redirect("/admin/settings?test=sent");
}
