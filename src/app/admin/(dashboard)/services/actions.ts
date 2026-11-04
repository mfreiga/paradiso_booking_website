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

  const priceType = String(formData.get("priceType") ?? "");

  const data: { priceCents?: number; durationMinutes?: number; priceType?: "FIXED" | "FROM" | "ON_REQUEST" } = {};
  const euros = Number.parseFloat(priceRaw);
  const duration = Number.parseInt(durationRaw, 10);
  if (!Number.isNaN(euros) && euros >= 0 && euros <= 2000) data.priceCents = Math.round(euros * 100);
  // At least 5 minutes: a 0-minute service would break the slot calendar.
  if (!Number.isNaN(duration) && duration >= 5 && duration <= 600) data.durationMinutes = duration;
  if (priceType === "FIXED" || priceType === "FROM" || priceType === "ON_REQUEST") data.priceType = priceType;

  if (Object.keys(data).length > 0) {
    await prisma.serviceVariant.update({ where: { id }, data });
  }
  revalidatePath("/admin/services");
  revalidatePath("/", "layout"); // homepage price cards + booking
}

export async function renameService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return;
  await prisma.service.update({ where: { id }, data: { name } });
  revalidatePath("/admin/services");
  revalidatePath("/", "layout");
}

const LENGTHS = ["Kurz", "Mittel", "Lang"] as const;

/** New service in a category; offered right away by every active barber of that area. */
export async function createService(formData: FormData) {
  await requireAdmin();
  const categoryId = String(formData.get("categoryId"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const euros = Number.parseFloat(String(formData.get("price") ?? "").replace(",", "."));
  const duration = Number.parseInt(String(formData.get("duration") ?? ""), 10);
  const raw = String(formData.get("priceType") ?? "FIXED");
  const priceType = raw === "FROM" || raw === "ON_REQUEST" ? raw : "FIXED";
  const tiered = formData.get("tiered") === "1";
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || !name || Number.isNaN(duration) || duration < 5 || duration > 600) return;
  const priceCents = Number.isNaN(euros) || euros < 0 ? 0 : Math.round(Math.min(euros, 2000) * 100);

  const last = await prisma.service.findFirst({
    where: { categoryId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  const barberGender = category.gender === "MEN" ? ["MALE"] : category.gender === "WOMEN" ? ["FEMALE"] : ["MALE", "FEMALE"];
  const barbers = await prisma.stylist.findMany({
    where: { isActive: true, gender: { in: barberGender as ("MALE" | "FEMALE")[] } },
    select: { id: true },
  });
  await prisma.service.create({
    data: {
      name,
      gender: category.gender,
      categoryId,
      displayOrder: (last?.displayOrder ?? 0) + 1,
      variants: {
        create: (tiered ? LENGTHS : (["Standard"] as const)).map((label, i) => ({
          label,
          priceCents,
          durationMinutes: duration,
          priceType,
          displayOrder: i,
        })),
      },
      stylists: { create: barbers.map((b) => ({ stylistId: b.id })) },
    },
  });
  revalidatePath("/admin/services");
  revalidatePath("/", "layout");
}
