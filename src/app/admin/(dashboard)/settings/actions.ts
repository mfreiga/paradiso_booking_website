"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

const clampInt = (v: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  const current = await prisma.setting.findUnique({ where: { id: 1 } });
  const rating = Number.parseFloat(String(formData.get("googleRating") ?? "").replace(",", "."));

  const data = {
    shopPhone: String(formData.get("shopPhone") ?? "").trim().slice(0, 40) || current?.shopPhone || "",
    shopAddress: String(formData.get("shopAddress") ?? "").trim().slice(0, 120) || null,
    bookingWindowDays: clampInt(formData.get("bookingWindowDays"), 7, 365, current?.bookingWindowDays ?? 60),
    minLeadTimeMin: clampInt(formData.get("minLeadTimeMin"), 0, 7 * 24 * 60, current?.minLeadTimeMin ?? 120),
    cancellationCutoffMin: clampInt(formData.get("cancellationCutoffMin"), 0, 7 * 24 * 60, current?.cancellationCutoffMin ?? 120),
    slotGranularityMin: clampInt(formData.get("slotGranularityMin"), 5, 60, current?.slotGranularityMin ?? 15),
    defaultBufferMin: clampInt(formData.get("defaultBufferMin"), 0, 60, current?.defaultBufferMin ?? 0),
    googleRating: Number.isNaN(rating) ? (current?.googleRating ?? 4.3) : Math.min(5, Math.max(1, Math.round(rating * 10) / 10)),
    googleReviewCount: clampInt(formData.get("googleReviewCount"), 0, 1_000_000, current?.googleReviewCount ?? 0),
  };
  await prisma.setting.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

  for (const p of ["/admin/settings", "/admin", "/", "/book"]) revalidatePath(p);
  redirect("/admin/settings?saved=1");
}
