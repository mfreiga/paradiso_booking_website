"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export async function toggleServiceField(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const field = String(formData.get("field"));
  const next = formData.get("next") === "true";
  if (field !== "isActive" && field !== "isPopular") return;
  const data = field === "isActive" ? { isActive: next } : { isPopular: next };
  await prisma.service.update({ where: { id }, data });
  revalidatePath("/admin/services");
}

export async function updateVariant(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const priceRaw = String(formData.get("price") ?? "").replace(",", ".").trim();
  const durationRaw = String(formData.get("duration") ?? "").trim();

  const data: { priceCents?: number; durationMinutes?: number } = {};
  const euros = Number.parseFloat(priceRaw);
  const duration = Number.parseInt(durationRaw, 10);
  if (!Number.isNaN(euros) && euros >= 0) data.priceCents = Math.round(euros * 100);
  if (!Number.isNaN(duration) && duration >= 0) data.durationMinutes = duration;

  if (Object.keys(data).length > 0) {
    await prisma.serviceVariant.update({ where: { id }, data });
  }
  revalidatePath("/admin/services");
}
