"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ReviewResult = { ok: true } | { ok: false; error: string };

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
  if (!token) return { ok: false, error: "Ungültiger Link." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Bitte 1–5 Sterne wählen." };
  }

  const appt = await prisma.appointment.findUnique({
    where: { reviewToken: token },
    include: { review: true },
  });
  if (!appt) return { ok: false, error: "Termin nicht gefunden." };
  if (appt.status === "CANCELLED") {
    return { ok: false, error: "Für stornierte Termine ist keine Bewertung möglich." };
  }
  if (appt.review) return { ok: false, error: "Du hast diesen Termin bereits bewertet." };

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
