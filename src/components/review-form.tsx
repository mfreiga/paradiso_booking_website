"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/app/review/[token]/actions";

export function ReviewForm({ token, barberName }: { token: string; barberName: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
        Danke für deine Bewertung! Sie wird vor der Veröffentlichung kurz geprüft.
      </p>
    );
  }

  function submit() {
    setError(null);
    if (rating < 1) {
      setError("Bitte wähle 1–5 Sterne.");
      return;
    }
    startTransition(async () => {
      const res = await submitReview(token, rating, comment);
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">Wie war dein Termin bei {barberName}?</p>
      <div className="flex gap-1 text-4xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className={(hover || rating) >= n ? "text-amber-500" : "text-neutral-300"}
            aria-label={`${n} Sterne`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Optional: Erzähl uns mehr…"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="rounded-full bg-orange-500 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? "Senden…" : "Bewertung abschicken"}
      </button>
    </div>
  );
}
