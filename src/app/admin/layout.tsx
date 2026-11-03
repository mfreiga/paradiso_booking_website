import type { Metadata } from "next";

// Applies to the login and every admin page: own titles, never indexed, and
// installable to the iPhone Home Screen as "Paradiso Admin" (opens /admin).
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Paradiso Admin" },
  robots: { index: false, follow: false },
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "Paradiso Admin", statusBarStyle: "default" },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
