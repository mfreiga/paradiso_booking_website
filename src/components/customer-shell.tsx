import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { LanguageSwitch } from "./language-switch";

/** Dark frame for the small customer pages (manage, move, review) — same look as the site. */
export function CustomerShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-2 flex justify-end">
          <LanguageSwitch locale={locale} />
        </div>
        <div className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-orange-400">Hairstyling</p>
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight transition hover:text-orange-400">
            Paradiso
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}
