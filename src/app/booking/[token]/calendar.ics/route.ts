import { prisma } from "@/lib/prisma";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { tName } from "@/lib/service-i18n";
import { siteUrl } from "@/lib/site-url";
import { buildIcs } from "@/lib/ics";

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

  const locale = await getLocale();
  const t = dict[locale].manage;
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const manageUrl = `${siteUrl()}/booking/${token}`;
  const services = appt.items.map((i) => tName(i.nameSnapshot, locale)).join(", ");

  const ics = buildIcs({
    uid: `${appt.id}@paradiso`,
    start: appt.startAt,
    end: appt.endAt,
    title: t.calTitle,
    location: setting?.shopAddress ?? "Augustenstraße 72, 80333 München",
    description: `${services} · ${t.calWith} ${appt.stylist.name}\n\n${t.calManage}\n${manageUrl}`,
    url: manageUrl,
    alarmMinutesBefore: 120,
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
