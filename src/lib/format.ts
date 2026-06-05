const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const dateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});
const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

export function formatEur(cents: number): string {
  return eur.format(cents / 100);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std ${m} Min` : `${h} Std`;
}

export function formatDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}

export function formatTime(d: Date): string {
  return timeFmt.format(d);
}
