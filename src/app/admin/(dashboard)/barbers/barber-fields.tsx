// Profile + working-hours inputs shared by the "new" and "edit" barber forms.

const dayLabels = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const inputClass =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500";

/** Salon hours from the price list: Mon–Fri 09–20, Sat 09–19. */
export const DEFAULT_HOURS = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinutes: 9 * 60,
  endMinutes: weekday === 6 ? 19 * 60 : 20 * 60,
}));

export function BarberProfileFields({
  name = "",
  bio = "",
  gender = "MALE",
}: {
  name?: string;
  bio?: string | null;
  gender?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-neutral-700">
        Name
        <input name="name" required maxLength={60} defaultValue={name} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-neutral-700">
        Bereich
        <select name="gender" defaultValue={gender} className={inputClass}>
          <option value="MALE">Herren (Barber)</option>
          <option value="FEMALE">Damen</option>
        </select>
      </label>
      <label className="text-sm font-medium text-neutral-700 sm:col-span-2">
        Kurzbeschreibung (erscheint auf der Website)
        <textarea name="bio" rows={2} maxLength={300} defaultValue={bio ?? ""} className={inputClass} />
      </label>
    </div>
  );
}

export function WorkingHoursFields({
  hours,
}: {
  hours: { weekday: number; startMinutes: number; endMinutes: number }[];
}) {
  const byDay = new Map(hours.map((w) => [w.weekday, w]));
  return (
    <fieldset>
      <legend className="text-sm font-medium text-neutral-700">Arbeitszeiten</legend>
      <p className="text-xs text-neutral-400">Nur an angehakten Tagen ist online eine Buchung möglich.</p>
      <div className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
          const w = byDay.get(wd);
          return (
            <div key={wd} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
              <label className="flex w-32 items-center gap-2">
                <input type="checkbox" name={`day_${wd}_on`} defaultChecked={!!w} className="h-4 w-4 accent-orange-500" />
                <span>{dayLabels[wd]}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  name={`day_${wd}_start`}
                  step={900}
                  defaultValue={w ? hhmm(w.startMinutes) : "09:00"}
                  className="rounded-lg border border-neutral-300 px-2 py-1"
                />
                <span className="text-neutral-400">–</span>
                <input
                  type="time"
                  name={`day_${wd}_end`}
                  step={900}
                  defaultValue={w ? hhmm(w.endMinutes) : "18:00"}
                  className="rounded-lg border border-neutral-300 px-2 py-1"
                />
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
