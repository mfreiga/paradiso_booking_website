"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { clearFailures, isLocked, loginKeys, recordFailure } from "@/lib/login-throttle";

export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const keys = await loginKeys(email);

  if (await isLocked(keys)) redirect("/admin/login?error=locked");

  try {
    await signIn("credentials", { email, password, redirectTo: "/admin" });
  } catch (error) {
    // signIn throws a redirect on success (must propagate); auth failures are AuthError.
    if (error instanceof AuthError) {
      await recordFailure(keys);
      redirect("/admin/login?error=1");
    }
    await clearFailures(keys);
    throw error;
  }
}
