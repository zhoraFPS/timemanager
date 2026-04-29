/**
 * Local-date helpers. All of these operate in the Node.js process' local
 * timezone, which must be `Europe/Berlin` in production (set via
 * `TZ=Europe/Berlin` env var). The whole app assumes this single source of
 * truth — clocks, reports, month-close, DATEV exports all compute against
 * the same local day boundaries.
 *
 * Avoid `Date.toISOString().split("T")[0]` for date-only strings: it returns
 * UTC and shifts the date across midnight whenever the local timezone is
 * offset from UTC (i.e. always in Germany). Use `toLocalDateString` instead.
 */

/**
 * YYYY-MM-DD in the process' local timezone.
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns a Date at 00:00:00 local time for the given civil date.
 * Useful for the lower bound of a day-range query.
 */
export function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * Returns a Date at 23:59:59.999 local time for the given civil date.
 * Useful for the upper bound of a day-range query.
 */
export function endOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

/**
 * Parses a "YYYY-MM-DD" as local midnight (NOT UTC midnight as `new Date(str)`
 * would). Use when you need to compare against a local-day boundary.
 */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}
