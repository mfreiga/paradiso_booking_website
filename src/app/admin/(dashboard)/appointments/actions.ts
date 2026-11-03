"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { sendCancellation, sendReviewRequest } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";

const allowed = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
type ApptStatus = (typeof allowed)[number];

export async function setAppointmentStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as ApptStatus;
  if (!allowed.includes(status)) return;
  const before = await prisma.appointment.findUnique({
    where: { id },
    include: { stylist: { select: { name: true } }, items: { select: { nameSnapshot: true } } },
  });
  if (!before) return;
  await prisma.appointment.update({ where: { id }, data: { status } });
  const locale = before.locale === "en" ? "en" : "de";

  try {
    // Done → ask for a review. Cancelled by the salon → let the customer know.
    if (status === "COMPLETED" && before.status !== "COMPLETED" && before.customerEmail) {
      await sendReviewRequest({
        to: before.customerEmail,
        locale,
        customerName: before.customerName,
        barberName: before.stylist.name,
        reviewUrl: `${siteUrl()}/review/${before.reviewToken}`,
      });
    }
    if (
      status === "CANCELLED" &&
      (before.status === "PENDING" || before.status === "CONFIRMED") &&
      before.customerEmail &&
      before.startAt.getTime() > Date.now()
    ) {
      await sendCancellation({
        to: before.customerEmail,
        locale,
        customerName: before.customerName,
        barberName: before.stylist.name,
        startAt: before.startAt,
        services: before.items.map((i) => i.nameSnapshot),
        bookUrl: `${siteUrl()}/book`,
        by: "shop",
      });
    }
  } catch (e) {
    console.error("status email failed:", e);
  }

  revalidatePath("/admin/appointments");
  revalidatePath("/admin");
}
