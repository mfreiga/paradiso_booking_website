"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { sendReviewRequest } from "@/lib/email";

const allowed = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
type ApptStatus = (typeof allowed)[number];

export async function setAppointmentStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as ApptStatus;
  if (!allowed.includes(status)) return;
  await prisma.appointment.update({ where: { id }, data: { status } });

  // When marked done, send the customer a review request (logged in dev).
  if (status === "COMPLETED") {
    try {
      const appt = await prisma.appointment.findUnique({
        where: { id },
        include: { stylist: { select: { name: true } } },
      });
      if (appt?.customerEmail) {
        await sendReviewRequest({
          to: appt.customerEmail,
          customerName: appt.customerName,
          barberName: appt.stylist.name,
          reviewUrl: `${process.env.AUTH_URL ?? "http://localhost:3000"}/review/${appt.reviewToken}`,
        });
      }
    } catch (e) {
      console.error("review request failed:", e);
    }
  }

  revalidatePath("/admin/appointments");
  revalidatePath("/admin");
}
