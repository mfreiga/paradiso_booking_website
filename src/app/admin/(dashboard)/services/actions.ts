"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import type { Gender, PriceType } from "@/generated/prisma/client";

const PRICE_TYPES: PriceType[] = ["FIXED", "FROM", "ON_REQUEST"];
const GENDERS: Gender[] = ["MEN", "WOMEN", "UNISEX"];

function refresh() {
  for (const p of ["/admin/services", "/admin/barbers", "/", "/book"]) revalidatePath(p);
}
const text = (v: FormDataEntryValue | null, max = 80) => String(v ?? "").trim().slice(0, max);
const cents = (v: FormDataEntryValue | null) => {
  const n = Number.parseFloat(String(v ?? "").replace(",", "."));
  return Number.isNaN(n) || n < 0 ? null : Math.round(n * 100);
};
const minutes = (v: FormDataEntryValue | null) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isNaN(n) || n < 5 || n > 600 ? null : n;
};
const priceType = (v: FormDataEntryValue | null): PriceType =>
  PRICE_TYPES.includes(String(v) as PriceType) ? (String(v) as PriceType) : "FIXED";
const back = (msg: string, anchor?: string) => redirect(`/admin/services?msg=${msg}${anchor ? `#${anchor}` : ""}`);

export async function toggleServiceField(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const field = String(formData.get("field"));
  const next = formData.get("next") === "true";
  if (field !== "isActive" && field !== "isPopular") return;
  const data = field === "isActive" ? { isActive: next } : { isPopular: next };
  await prisma.service.update({ where: { id }, data });
  refresh();
}

// ── categories ──────────────────────────────────────────────────────────────
export async function createCategory(formData: FormData) {
  await requireAdmin();
  const name = text(formData.get("name"));
  const gender = String(formData.get("gender")) as Gender;
  if (!name || !GENDERS.includes(gender)) back("catInvalid");
  const last = await prisma.category.findFirst({ where: { gender }, orderBy: { displayOrder: "desc" }, select: { displayOrder: true } });
  const c = await prisma.category.create({
    data: { name, nameEn: text(formData.get("nameEn")) || null, gender, displayOrder: (last?.displayOrder ?? 0) + 1 },
  });
  refresh();
  back("catCreated", `cat-${c.id}`);
}

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const name = text(formData.get("name"));
  if (!name) back("catInvalid", `cat-${id}`);
  await prisma.category.update({
    where: { id },
    data: { name, nameEn: text(formData.get("nameEn")) || null, isActive: formData.get("isActive") === "on" },
  });
  refresh();
  back("saved", `cat-${id}`);
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const count = await prisma.service.count({ where: { categoryId: id } });
  if (count > 0) back("catNotEmpty", `cat-${id}`);
  await prisma.category.delete({ where: { id } });
  refresh();
  back("deleted");
}

// ── services ────────────────────────────────────────────────────────────────
export async function createService(formData: FormData) {
  await requireAdmin();
  const categoryId = String(formData.get("categoryId"));
  const name = text(formData.get("name"));
  const price = cents(formData.get("price"));
  const duration = minutes(formData.get("duration"));
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || !name || price === null || duration === null) back("svcInvalid", `cat-${categoryId}`);

  const last = await prisma.service.findFirst({ where: { categoryId }, orderBy: { displayOrder: "desc" }, select: { displayOrder: true } });
  const svc = await prisma.service.create({
    data: {
      name,
      nameEn: text(formData.get("nameEn")) || null,
      gender: category!.gender,
      categoryId,
      isAddOn: formData.get("isAddOn") === "on",
      displayOrder: (last?.displayOrder ?? 0) + 1,
      variants: { create: { label: "Standard", priceCents: price!, durationMinutes: duration!, priceType: priceType(formData.get("priceType")) } },
    },
  });
  if (formData.get("assignAll") === "on") {
    const genders = category!.gender === "MEN" ? ["MALE"] : category!.gender === "WOMEN" ? ["FEMALE"] : ["MALE", "FEMALE"];
    const barbers = await prisma.stylist.findMany({ where: { isActive: true, gender: { in: genders as ("MALE" | "FEMALE")[] } }, select: { id: true } });
    await prisma.stylistService.createMany({ data: barbers.map((b) => ({ stylistId: b.id, serviceId: svc.id })), skipDuplicates: true });
  }
  refresh();
  back("svcCreated", `svc-${svc.id}`);
}

/** Saves name, flags and every price variant of one service in one go. */
export async function saveService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const name = text(formData.get("name"));
  if (!name) back("svcInvalid", `svc-${id}`);

  const existing = await prisma.serviceVariant.findMany({ where: { serviceId: id }, select: { id: true } });
  const updates: { id: string; label: string; priceCents: number; durationMinutes: number; priceType: PriceType }[] = [];
  const removals: string[] = [];
  for (const v of existing) {
    if (formData.get(`v_${v.id}_delete`) === "on") {
      removals.push(v.id);
      continue;
    }
    const p = cents(formData.get(`v_${v.id}_price`));
    const d = minutes(formData.get(`v_${v.id}_duration`));
    if (p === null || d === null) back("svcInvalid", `svc-${id}`);
    updates.push({ id: v.id, label: text(formData.get(`v_${v.id}_label`), 40) || "Standard", priceCents: p!, durationMinutes: d!, priceType: priceType(formData.get(`v_${v.id}_type`)) });
  }
  const newLabel = text(formData.get("new_label"), 40);
  const newPrice = cents(formData.get("new_price"));
  const newDuration = minutes(formData.get("new_duration"));
  const addNew = !!newLabel && newPrice !== null && newDuration !== null;
  if (updates.length === 0 && !addNew) back("svcNoVariant", `svc-${id}`);

  // Variants already used in bookings can't be deleted (history keeps a link) — keep those.
  const used = new Set(
    (await prisma.appointmentItem.findMany({ where: { serviceVariantId: { in: removals } }, select: { serviceVariantId: true } })).map((i) => i.serviceVariantId),
  );

  await prisma.$transaction([
    prisma.service.update({
      where: { id },
      data: {
        name,
        nameEn: text(formData.get("nameEn")) || null,
        isAddOn: formData.get("isAddOn") === "on",
        isPopular: formData.get("isPopular") === "on",
        isActive: formData.get("isActive") === "on",
      },
    }),
    ...updates.map(({ id: vid, ...data }) => prisma.serviceVariant.update({ where: { id: vid }, data })),
    ...(removals.filter((r) => !used.has(r)).length
      ? [prisma.serviceVariant.deleteMany({ where: { id: { in: removals.filter((r) => !used.has(r)) } } })]
      : []),
    ...(addNew
      ? [
          prisma.serviceVariant.create({
            data: { serviceId: id, label: newLabel, priceCents: newPrice!, durationMinutes: newDuration!, priceType: priceType(formData.get("new_type")), displayOrder: existing.length + 1 },
          }),
        ]
      : []),
  ]);
  refresh();
  back(used.size > 0 ? "variantInUse" : "saved", `svc-${id}`);
}

/** Deletes a never-booked service; one with booking history is only deactivated. */
export async function deleteService(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const used = await prisma.appointmentItem.count({ where: { serviceId: id } });
  if (used > 0) {
    await prisma.service.update({ where: { id }, data: { isActive: false } });
    refresh();
    back("svcDeactivated", `svc-${id}`);
  }
  await prisma.service.delete({ where: { id } });
  refresh();
  back("deleted");
}
