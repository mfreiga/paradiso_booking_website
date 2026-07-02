"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

// DE | EN pill. Sets the `lang` cookie and re-renders the server components.
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();

  function setLang(lang: Locale) {
    if (lang === locale) return;
    document.cookie = `lang=${lang};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <div
      className="flex items-center rounded-full border border-white/15 bg-white/5 p-0.5 text-xs font-semibold"
      role="group"
      aria-label="Sprache / Language"
    >
      {(["de", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => setLang(lang)}
          aria-pressed={locale === lang}
          className={`rounded-full px-2.5 py-1 uppercase transition ${
            locale === lang
              ? "bg-orange-500 text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
