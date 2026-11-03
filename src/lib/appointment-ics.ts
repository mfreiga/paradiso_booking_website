import { dict, type Locale } from "./i18n";
import { tName } from "./service-i18n";
import { buildIcs } from "./ics";

export const DEFAULT_SHOP_ADDRESS = "Augustenstraße 72, 80333 München";

/** The calendar entry for one appointment — same file for the email attachment and the download link. */
export function appointmentIcs(a: {
  id: string;
  startAt: Date;
  endAt: Date;
  stylistName: string;
  services: string[];
  manageUrl: string;
  locale: Locale;
  address?: string | null;
}): string {
  const t = dict[a.locale].manage;
  const services = a.services.map((s) => tName(s, a.locale)).join(", ");
  return buildIcs({
    uid: `${a.id}@paradiso`,
    start: a.startAt,
    end: a.endAt,
    title: t.calTitle,
    location: a.address || DEFAULT_SHOP_ADDRESS,
    description: `${services} · ${t.calWith} ${a.stylistName}\n\n${t.calManage}\n${a.manageUrl}`,
    url: a.manageUrl,
    alarmMinutesBefore: 120,
  });
}
