import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { isOwner, requireAppointmentAccess } from "@/lib/auth-guard";
import { dict } from "@/lib/i18n";
import { qualifiedBarbersFor } from "@/lib/reschedule";
import { RescheduleForm } from "@/components/reschedule-form";
import { adminMove, adminMoveDays, adminMoveSlots } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminMovePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { staff } = await requireAppointmentAccess(id); // barbers: own appointments only
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: { stylist: { select: { id: true, name: true } }, items: { select: { nameSnapshot: true } } },
  });
  if (!appt) notFound();
  const active = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const [qualified, setting] = await Promise.all([qualifiedBarbersFor(id), prisma.setting.findUnique({ where: { id: 1 } })]);
  // A barber moves within their own column; only the owner can hand it to someone else.
  const barbers = isOwner(staff) ? qualified : qualified.filter((b) => b.id === staff.stylistId);
  const t = dict.de;
  const now = DateTime.now().setZone("Europe/Berlin");
  const current = DateTime.fromJSDate(appt.startAt).setZone("Europe/Berlin").setLocale("de").toFormat("cccc, d. LLLL, HH:mm");

  return (
    <div className="max-w-xl">
      <Link href="/admin/appointments" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Termine
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Termin verschieben</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {appt.customerName} · {appt.items.map((i) => i.nameSnapshot).join(", ")}
        <br />
        Bisher: {current} bei {appt.stylist.name}
      </p>
      {!active ? (
        <p className="mt-6 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-600">Dieser Termin ist nicht mehr aktiv.</p>
      ) : (
        <div className="mt-6">
          <RescheduleForm
            barbers={barbers}
            initialBarberId={barbers.some((b) => b.id === appt.stylistId) ? appt.stylistId : (barbers[0]?.id ?? appt.stylistId)}
            loadDays={adminMoveDays.bind(null, id)}
            loadSlots={adminMoveSlots.bind(null, id)}
            submit={adminMove.bind(null, id)}
            minDate={now.toISODate()!}
            maxDate={now.plus({ days: setting?.bookingWindowDays ?? 60 }).toISODate()!}
            weekdaysShort={t.weekdaysShort}
            locale="de-DE"
            labels={{
              barber: "Bei wem?",
              date: "Neuer Tag",
              noSlots: "An dem Tag ist nichts frei.",
              loading: "Freie Zeiten werden geladen…",
              confirm: "Verschieben",
              moving: "Wird verschoben…",
              failed: "Die Zeit ist nicht mehr frei. Bitte eine andere wählen.",
              prevMonth: "Vorheriger Monat",
              nextMonth: "Nächster Monat",
              morning: "Vormittag",
              afternoon: "Nachmittag",
              evening: "Abend",
            }}
            doneHref="/admin/appointments"
            theme="light"
          />
          {appt.customerEmail && <p className="mt-3 text-xs text-neutral-400">Die Person bekommt eine E-Mail mit der neuen Zeit und einem neuen Kalendereintrag.</p>}
        </div>
      )}
    </div>
  );
}
