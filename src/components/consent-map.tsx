"use client";

import { useState } from "react";

// Google Maps transfers the visitor's IP to Google as soon as the iframe
// loads, so it only loads after an explicit click (GDPR). Not remembered,
// which keeps the site free of consent cookies.
export function ConsentMap({
  src,
  title,
  loadLabel,
  consentText,
  className,
}: {
  src: string;
  title: string;
  loadLabel: string;
  consentText: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        title={title}
        src={src}
        className={className}
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 bg-neutral-900 px-6 text-center ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-10 w-10 text-orange-400" aria-hidden>
        <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
      <button
        type="button"
        onClick={() => setLoaded(true)}
        className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium transition hover:border-orange-500 hover:text-orange-400"
      >
        {loadLabel}
      </button>
      <p className="max-w-xs text-xs leading-relaxed text-neutral-500">{consentText}</p>
    </div>
  );
}
