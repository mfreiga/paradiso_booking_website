"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isPast } from "@/lib/time";
import { REVIEW_COMMENT_MAX } from "@/lib/booking-limits";

/** Codes are keys of i18n `review`, translated in the review form. */
export type ReviewErrorCode = "invalid" | "pickStars" | "tooLong" | "cancelledNo" | "tooEarly" | "already";

export type ReviewResult = { ok: true } | { ok: false; error: ReviewErrorCode };

function displayNameFrom(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Gast";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export async function submitReview(
  token: string,
  rating: number,
  comment: string,
): Promise<ReviewResult> {
  if (!token) return { ok: false, error: "invalid" };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "pickStars" };
  }
  if (comment.length > REVIEW_COMMENT_MAX) return { ok: false, error: "tooLong" };

  const appt = await prisma.appointment.findUnique({
    where: { reviewToken: token },
    include: { review: true },
  });
  if (!appt) return { ok: false, error: "invalid" };
  if (appt.status === "CANCELLED") return { ok: false, error: "cancelledNo" };
  if (appt.status !== "COMPLETED" && !isPast(appt.startAt)) {
    return { ok: false, error: "tooEarly" };
  }
  if (appt.review) return { ok: false, error: "already" };

  await prisma.review.create({
    data: {
      stylistId: appt.stylistId,
      appointmentId: appt.id,
      displayName: displayNameFrom(appt.customerName),
      rating,
      comment: comment.trim() || null,
      status: "PENDING",
    },
  });
  revalidatePath("/admin/reviews");
  return { ok: true };
}
