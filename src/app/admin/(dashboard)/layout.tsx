import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { signOut } from "@/auth";

const nav = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/appointments", label: "Termine" },
  { href: "/admin/calendar", label: "Kalender" },
  { href: "/admin/time-off", label: "Abwesenheiten" },
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">Paradiso Admin</span>
          {/* Full-width swipeable row on phones, inline on larger screens. */}
          <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-4 overflow-x-auto whitespace-nowrap px-4 pb-1 text-sm lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:px-0 lg:pb-0">
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
