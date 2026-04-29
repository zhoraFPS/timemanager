import { isWeekend } from "date-fns";

/**
 * Zählt Arbeitstage (Mo-Fr) zwischen zwei Daten (inklusiv).
 */
export function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (current <= end) {
    if (!isWeekend(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Berechnet die Netto-Arbeitsminuten eines TimeEntry-Blocks.
 * Zieht automatisch die Pause ab wenn autoBreak aktiv und Arbeit > breakAfterHours.
 */
export function calcNetMins(
  clockIn: Date,
  clockOut: Date,
  opts: {
    autoBreak: boolean;
    breakAfterHours: number;
    breakMinutes: number;
  }
): number {
  const rawMins = Math.floor(
    (clockOut.getTime() - clockIn.getTime()) / 60000
  );
  if (
    opts.autoBreak &&
    rawMins > opts.breakAfterHours * 60
  ) {
    return Math.max(0, rawMins - opts.breakMinutes);
  }
  return rawMins;
}
