// Request-time clock checks for server components (rendered once per request,
// so reading the current time here is intentional, not a render impurity).

/** Milliseconds from now until `date` (negative if it's in the past). */
export function msUntil(date: Date): number {
  return date.getTime() - Date.now();
}

/** True if `date` is already in the past. */
export function isPast(date: Date): boolean {
  return msUntil(date) < 0;
}
