// Shared status labels/colours for the admin appointment views.
export const statusLabel: Record<string, string> = {
  PENDING: "Offen",
  CONFIRMED: "Bestätigt",
  COMPLETED: "Erledigt",
  CANCELLED: "Storniert",
  NO_SHOW: "Nicht erschienen",
};

export const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-neutral-200 text-neutral-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-orange-100 text-orange-800",
};
