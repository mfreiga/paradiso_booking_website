import Link from "next/link";
import { isOwner, requireStaff } from "@/lib/auth-guard";
import { signOut } from "@/auth";

// `owner: true` = only the owner sees it (barbers only work with their own bookings).
const allNav = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/appointments", label: "Termine" },
  { href: "/admin/calendar", label: "Kalender" },
  { href: "/admin/time-off", label: "Zeit blockieren" },
  { href: "/admin/services", label: "Leistungen", owner: true },
  { href: "/admin/barbers", label: "Friseure", owner: true },
  { href: "/admin/team", label: "Team-Zugänge", owner: true },
  { href: "/admin/reviews", label: "Bewertungen", owner: true },
  { href: "/admin/settings", label: "Einstellungen", owner: true },
  { href: "/admin/account", label: "Mein Konto" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  const nav = allNav.filter((item) => !item.owner || isOwner(staff));

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Paradiso Admin
          </Link>
          <nav className="hidden flex-1 gap-4 text-sm xl:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap text-neutral-600 hover:text-neutral-900">
                {item.label}
              </Link>
            ))}
          </nav>
          {/* Phones, tablets, small laptops: a menu button that opens a vertical list. */}
          <details className="group xl:hidden">
            <summary className="cursor-pointer list-none rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">☰ Menü</span>
              <span className="hidden group-open:inline">✕ Schließen</span>
            </summary>
            <nav className="absolute inset-x-0 top-full z-20 border-b border-neutral-200 bg-white px-4 py-2 shadow-lg">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block border-b border-neutral-100 py-3 text-base text-neutral-700 last:border-0"
                >
                  {item.label}
                </Link>
              ))}
              <form action={doSignOut} className="py-3">
                <button type="submit" className="text-base text-red-700">
                  Abmelden
                </button>
              </form>
            </nav>
          </details>
          <div className="hidden items-center gap-3 text-sm text-neutral-500 xl:flex">
            <span className="hidden xl:inline">
              {staff.name}
              {!isOwner(staff) && " · Friseur:in"}
            </span>
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
