import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { setReviewStatus, deleteReview } from "./actions";

const statusLabel: Record<string, string> = {
  PENDING: "Offen",
  PUBLISHED: "Veröffentlicht",
  HIDDEN: "Verborgen",
};
const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-green-100 text-green-800",
  HIDDEN: "bg-neutral-200 text-neutral-600",
};
const rank: Record<string, number> = { PENDING: 0, PUBLISHED: 1, HIDDEN: 2 };

export default async function ReviewsAdminPage() {
  await requireAdmin();
  const reviews = await prisma.review.findMany({
    include: { stylist: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  reviews.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  const pending = reviews.filter((r) => r.status === "PENDING").length;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bewertungen</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {pending} offen · {reviews.length} gesamt. Veröffentlichte Bewertungen
        erscheinen bei der Buchung.
      </p>

      <div className="mt-6 space-y-3">
        {reviews.length === 0 && (
          <p className="text-sm text-neutral-400">Noch keine Bewertungen.</p>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-500">
                  {"★".repeat(r.rating)}
                  <span className="text-neutral-300">{"★".repeat(5 - r.rating)}</span>
                </span>
                <span className="font-medium">{r.displayName}</span>
                <span className="text-xs text-neutral-400">· {r.stylist.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] ?? ""}`}
                >
                  {statusLabel[r.status] ?? r.status}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {r.status !== "PUBLISHED" && (
                  <StatusBtn id={r.id} status="PUBLISHED" label="Veröffentlichen" />
                )}
                {r.status !== "HIDDEN" && (
                  <StatusBtn id={r.id} status="HIDDEN" label="Verbergen" />
                )}
                <form action={deleteReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50">
                    Löschen
                  </button>
                </form>
              </div>
            </div>
            {r.comment && <p className="mt-2 text-sm text-neutral-600">„{r.comment}“</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBtn({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setReviewStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="rounded border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
        {label}
      </button>
    </form>
  );
}
