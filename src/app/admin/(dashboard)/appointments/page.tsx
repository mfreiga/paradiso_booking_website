import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { formatDateTime, formatDuration, formatEur } from "@/lib/format";
import { setAppointmentStatus } from "./actions";

const statusLabel: Record<string, string> = {
  PENDING: "Offen",
  CONFIRMED: "Bestätigt",
  COMPLETED: "Erledigt",
  CANCELLED: "Storniert",
  NO_SHOW: "No-Show",
};
const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-neutral-200 text-neutral-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

export default async function AppointmentsAdminPage() {
  await requireAdmin();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const barbers = await prisma.stylist.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      appointments: {
        where: { startAt: { gte: startOfToday } },
        orderBy: { startAt: "asc" },
        include: { items: true },
      },
    },
  });
  const total = barbers.reduce((n, b) => n + b.appointments.length, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Termine</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Kommende Termine je Friseur ({total} gesamt).
          </p>
        </div>
        <Link
          href="/admin/appointments/new"
          className="shrink-0 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          + Neuer Termin
        </Link>
      </div>

      <div className="mt-6 space-y-6">
        {barbers.map((b) => (
          <div
            key={b.id}
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-2">
              <span className="font-medium">{b.name}</span>
              <span className="text-xs text-neutral-400">
                {b.appointments.length} Termine
              </span>
            </div>
            {b.appointments.length === 0 ? (
              <p className="px-4 py-3 text-sm text-neutral-400">
                Keine kommenden Termine.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {b.appointments.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatDateTime(a.startAt)}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {formatDuration(a.totalDurationMinutes)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${statusClass[a.status] ?? ""}`}
                        >
                          {statusLabel[a.status] ?? a.status}
                        </span>
                      </div>
                      <div className="text-sm text-neutral-600">
                        {a.customerName} · {a.customerPhone}
                      </div>
                      <div className="text-sm text-neutral-500">
                        {a.items
                          .map(
                            (i) =>
                              i.nameSnapshot +
                              (i.variantLabelSnapshot &&
                              i.variantLabelSnapshot !== "Standard"
                                ? ` (${i.variantLabelSnapshot})`
                                : ""),
                          )
                          .join(", ")}{" "}
                        · {a.priceIsFrom ? "ab " : ""}
                        {formatEur(a.totalPriceCents)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusButton id={a.id} status="COMPLETED" label="Erledigt" />
                      <StatusButton id={a.id} status="NO_SHOW" label="No-Show" />
                      <StatusButton
                        id={a.id}
                        status="CANCELLED"
                        label="Stornieren"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusButton({
  id,
  status,
  label,
}: {
  id: string;
  status: string;
  label: string;
}) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
        {label}
      </button>
    </form>
  );
}
