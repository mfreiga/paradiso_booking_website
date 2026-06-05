import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { signOut } from "@/auth";

const nav = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/appointments", label: "Termine" },
  { href: "/admin/calendar", label: "Kalender" },
  { href: "/admin/services", label: "Leistungen" },
  { href: "/admin/barbers", label: "Friseure" },
  { href: "/admin/reviews", label: "Bewertungen" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Paradiso Admin</span>
            <nav className="flex gap-4 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-neutral-600 hover:text-neutral-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span className="hidden sm:inline">{session.user?.email}</span>
            <form action={doSignOut}>
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
