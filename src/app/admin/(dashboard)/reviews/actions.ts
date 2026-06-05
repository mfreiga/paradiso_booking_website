"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

const ALLOWED = ["PENDING", "PUBLISHED", "HIDDEN"] as const;
type RStatus = (typeof ALLOWED)[number];

export async function setReviewStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as RStatus;
  if (!ALLOWED.includes(status)) return;
  await prisma.review.update({ where: { id }, data: { status } });
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
}

export async function deleteReview(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  if (!id) return;
  await prisma.review.delete({ where: { id } });
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
}
