"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-guard";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";

/** Staff change their own password (needs the current one). */
export async function changeOwnPassword(formData: FormData) {
  const staff = await requireStaff();
  if (staff.isEnvAdmin) redirect("/admin/account?status=env");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  const user = await prisma.user.findUnique({ where: { id: staff.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(current, user?.passwordHash))) redirect("/admin/account?status=wrong");
  if (next !== repeat) redirect("/admin/account?status=mismatch");
  if (passwordProblem(next)) redirect("/admin/account?status=short");

  await prisma.user.update({ where: { id: staff.id }, data: { passwordHash: await hashPassword(next) } });
  redirect("/admin/account?status=ok");
}
