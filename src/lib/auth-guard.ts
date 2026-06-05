import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Returns the current admin session, or null. */
export async function getAdminSession() {
  return auth();
}

/**
 * Use at the top of any admin page/server action. Redirects to the login
 * page if there is no authenticated admin. Returns the session otherwise.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }
  return session;
}
