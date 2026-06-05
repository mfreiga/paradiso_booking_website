// Sample appointments for the admin Termine view + slot-engine testing.
// Separate from the catalog seed so it never wipes menu/barber edits.
//   Run:  npx tsx prisma/seed-appointments.ts
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const TZ = "Europe/Berlin";
const tok = () => randomBytes(24).toString("hex");

// Next occurrence of an ISO weekday (1=Mon … 7=Sun) at HH:MM in shop time.
function nextWeekdayAt(weekday: number, hour: number, minute: number): Date {
  const now = DateTime.now().setZone(TZ);
  let dt = now.set({
    weekday: weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (dt <= now) dt = dt.plus({ weeks: 1 });
  return dt.toUTC().toJSDate();
}

const samples = [
  { barber: "Bassam1", gender: "MEN", service: "Schneiden", variant: "Standard", wd: 2, h: 10, m: 0, name: "Ali Demir", phone: "0151 1111111" },
  { barber: "Bassam1", gender: "MEN", service: "Waschen, Schneiden, Styling", variant: "Standard", wd: 2, h: 11, m: 0, name: "Jonas Weber", phone: "0151 2222222" },
  { barber: "Bassam2", gender: "MEN", service: "Bart mit Übergang", variant: "Standard", wd: 3, h: 14, m: 0, name: "Mehmet Kaya", phone: "0151 3333333" },
  { barber: "Bassam4", gender: "WOMEN", service: "Waschen, Schneiden, Föhnen", variant: "Mittel", wd: 3, h: 9, m: 30, name: "Lena Schulz", phone: "0151 4444444" },
  { barber: "Bassam5", gender: "WOMEN", service: "Farbe", variant: "Lang", wd: 4, h: 13, m: 0, name: "Sofia Rossi", phone: "0151 5555555" },
] as const;

async function main() {
  await prisma.appointmentItem.deleteMany();
  await prisma.appointment.deleteMany();

  let created = 0;
  for (const s of samples) {
    const barber = await prisma.stylist.findFirst({ where: { name: s.barber } });
    const svc = await prisma.service.findFirst({
      where: { name: s.service, gender: s.gender },
      include: { variants: true },
    });
    if (!barber || !svc) {
      console.warn("skip (not found):", s.barber, "/", s.service);
      continue;
    }
    const v = svc.variants.find((x) => x.label === s.variant) ?? svc.variants[0];
    if (!v) continue;

    const startAt = nextWeekdayAt(s.wd, s.h, s.m);
    const endAt = new Date(startAt.getTime() + v.durationMinutes * 60_000);

    await prisma.appointment.create({
      data: {
        stylistId: barber.id,
        customerName: s.name,
        customerEmail:
          s.name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
        customerPhone: s.phone,
        startAt,
        endAt,
        status: "CONFIRMED",
        totalPriceCents: v.priceCents,
        totalDurationMinutes: v.durationMinutes,
        priceIsFrom: v.priceType === "FROM",
        manageToken: tok(),
        reviewToken: tok(),
        source: "CUSTOMER",
        items: {
          create: [
            {
              serviceId: svc.id,
              serviceVariantId: v.id,
              nameSnapshot: svc.name,
              variantLabelSnapshot: v.label,
              priceCentsSnapshot: v.priceCents,
              durationMinutesSnapshot: v.durationMinutes,
            },
          ],
        },
      },
    });
    created++;
  }
  console.log(`✅ Created ${created} sample appointments.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
