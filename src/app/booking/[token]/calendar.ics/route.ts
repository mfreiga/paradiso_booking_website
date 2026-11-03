import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/site-url";
import { appointmentIcs } from "@/lib/appointment-ics";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appt = await prisma.appointment.findUnique({
    where: { manageToken: token },
    include: { stylist: { select: { name: true } }, items: { select: { nameSnapshot: true } } },
  });
  if (!appt || appt.status === "CANCELLED") {
    return new Response("Not found", { status: 404 });
  }
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });

  const ics = appointmentIcs({
    id: appt.id,
    startAt: appt.startAt,
    endAt: appt.endAt,
    stylistName: appt.stylist.name,
    services: appt.items.map((i) => i.nameSnapshot),
    manageUrl: `${siteUrl()}/booking/${token}`,
    locale: await getLocale(),
    address: setting?.shopAddress,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="paradiso-termin.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
