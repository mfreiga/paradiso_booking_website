"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/app/review/[token]/actions";
import { dict, type Locale } from "@/lib/i18n";
import { REVIEW_COMMENT_MAX } from "@/lib/booking-limits";

export function ReviewForm({
  token,
  barberName,
  locale,
}: {
  token: string;
  barberName: string;
  locale: Locale;
}) {
  const t = dict[locale].review;
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="rounded-lg bg-green-500/10 p-4 text-sm text-green-400">
        {t.thanks}
      </p>
    );
  }

  function submit() {
    setError(null);
    if (rating < 1) {
      setError(t.pickStars);
      return;
    }
    startTransition(async () => {
      const res = await submitReview(token, rating, comment);
      if (res.ok) setDone(true);
      else setError(t[res.error]);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-300">
        {t.how} {barberName}?
      </p>
      <div className="flex gap-1 text-4xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className={(hover || rating) >= n ? "text-amber-400" : "text-neutral-700"}
            aria-label={`${n} ${t.stars}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={REVIEW_COMMENT_MAX}
        placeholder={t.placeholder}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? t.sending : t.send}
      </button>
    </div>
  );
}
