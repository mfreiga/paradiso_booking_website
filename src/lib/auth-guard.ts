import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface Staff {
  /** DB user id, or "env:<email>" for the shared owner login. */
  id: string;
  role: "OWNER" | "BARBER";
  name: string;
  email: string | null;
  /** The barber this login belongs to (barbers always have one; the owner may). */
  stylistId: string | null;
  /** Shared env login (no DB row, can't change its password here). */
  isEnvAdmin: boolean;
}

/**
 * The logged-in staff member, re-checked against the DB on every request so a
 * deactivated account or a changed role takes effect immediately (the JWT
 * alone would stay valid for weeks). Cached per request.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  if (id.startsWith("env:")) {
    return { id, role: "OWNER", name: "Inhaber", email: session.user.email ?? null, stylistId: null, isEnvAdmin: true };
  }
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true, username: true, email: true, isActive: true, stylistId: true },
  });
  if (!user?.isActive) return null;
  return {
    id: user.id,
    role: user.role === "BARBER" ? "BARBER" : "OWNER",
    name: user.name ?? user.username ?? "Team",
    email: user.email,
    stylistId: user.stylistId,
    isEnvAdmin: false,
  };
});

/** Any logged-in staff member (owner or barber). */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  return staff;
}

/**
 * Owner only: services, barbers, reviews, settings, team. Barbers who open
 * such a page land on their own overview instead.
 */
export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "OWNER") redirect("/admin?nur=inhaber");
  return staff;
}

export const isOwner = (s: Staff) => s.role === "OWNER";

/**
 * Prisma filter that limits appointments/time-off to what this person may
 * see: everything for the owner, only their own column for a barber. A barber
 * without a linked column sees nothing.
 */
export function stylistScope(s: Staff): { stylistId?: string } {
  return isOwner(s) ? {} : { stylistId: s.stylistId ?? "__none__" };
}

/** The barber a barber is allowed to act for; owners may pass any id through. */
export function allowedStylist(s: Staff, requested: string): string | null {
  if (isOwner(s)) return requested || null;
  return s.stylistId && (!requested || requested === s.stylistId) ? s.stylistId : null;
}

/** Loads an appointment the current staff member may touch, or 404s. */
export async function requireAppointmentAccess(appointmentId: string) {
  const staff = await requireStaff();
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { id: true, stylistId: true } });
  if (!appt || (!isOwner(staff) && appt.stylistId !== staff.stylistId)) notFound();
  return { staff, appt };
}
