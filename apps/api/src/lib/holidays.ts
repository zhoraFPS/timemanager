import { db } from "@/lib/db";
import { isWeekend } from "date-fns";

// German public holidays that fall on fixed dates
function getFixedHolidays(year: number): Array<{ date: string; name: string }> {
  return [
    { date: `${year}-01-01`, name: "Neujahr" },
    { date: `${year}-05-01`, name: "Tag der Arbeit" },
    { date: `${year}-10-03`, name: "Tag der Deutschen Einheit" },
    { date: `${year}-12-25`, name: "1. Weihnachtsfeiertag" },
    { date: `${year}-12-26`, name: "2. Weihnachtsfeiertag" },
  ];
}

// Easter-based holidays (Gauss algorithm)
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(d: Date): string {
  // Intentionally LOCAL-date formatting. Using toISOString() would convert to
  // UTC and shift the date across midnight for any non-UTC environment —
  // e.g. a Date at local 00:00 CET becomes 22:00 UTC the previous day, so
  // holiday lookups miss. Keep everything in the same local frame.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getEasterHolidays(year: number): Array<{ date: string; name: string }> {
  const easter = getEasterDate(year);
  return [
    { date: fmt(addDays(easter, -2)), name: "Karfreitag" },
    { date: fmt(addDays(easter, 1)), name: "Ostermontag" },
    { date: fmt(addDays(easter, 39)), name: "Christi Himmelfahrt" },
    { date: fmt(addDays(easter, 50)), name: "Pfingstmontag" },
    { date: fmt(addDays(easter, 60)), name: "Fronleichnam" },
  ];
}

// State-specific holidays
const STATE_HOLIDAYS: Record<string, (year: number) => Array<{ date: string; name: string }>> = {
  BW: (y) => [
    { date: `${y}-01-06`, name: "Heilige Drei Koenige" },
    { date: `${y}-11-01`, name: "Allerheiligen" },
  ],
  BY: (y) => [
    { date: `${y}-01-06`, name: "Heilige Drei Koenige" },
    { date: `${y}-08-15`, name: "Maria Himmelfahrt" },
    { date: `${y}-11-01`, name: "Allerheiligen" },
  ],
  NW: (y) => [
    { date: `${y}-11-01`, name: "Allerheiligen" },
  ],
  SN: (y) => [
    { date: `${y}-10-31`, name: "Reformationstag" },
    { date: fmt(addDays(getEasterDate(y), -46)), name: "Buss- und Bettag" },
  ],
  // Reformationstag states
  BB: (y) => [{ date: `${y}-10-31`, name: "Reformationstag" }],
  HB: (y) => [{ date: `${y}-10-31`, name: "Reformationstag" }],
  HH: (y) => [{ date: `${y}-10-31`, name: "Reformationstag" }],
  MV: (y) => [{ date: `${y}-10-31`, name: "Reformationstag" }],
  NI: (y) => [{ date: `${y}-10-31`, name: "Reformationstag" }],
  SH: (y) => [{ date: `${y}-10-31`, name: "Reformationstag" }],
  ST: (y) => [
    { date: `${y}-01-06`, name: "Heilige Drei Koenige" },
    { date: `${y}-10-31`, name: "Reformationstag" },
  ],
  TH: (y) => [
    { date: `${y}-10-31`, name: "Reformationstag" },
    { date: `${y}-09-20`, name: "Weltkindertag" },
  ],
  RP: (y) => [{ date: `${y}-11-01`, name: "Allerheiligen" }],
  SL: (y) => [
    { date: `${y}-08-15`, name: "Maria Himmelfahrt" },
    { date: `${y}-11-01`, name: "Allerheiligen" },
  ],
  BE: () => [{ date: "", name: "" }].slice(0, 0), // no extra
  HE: () => [],
};

/**
 * Get all holidays for a year, combining federal, state, and custom holidays.
 * Returns set of date strings "YYYY-MM-DD".
 */
export async function getHolidayDates(year: number): Promise<Set<string>> {
  const holidays = new Set<string>();

  // Federal + Easter holidays
  for (const h of [...getFixedHolidays(year), ...getEasterHolidays(year)]) {
    holidays.add(h.date);
  }

  // State holidays from settings
  const stateCfg = await db.systemConfig.findUnique({ where: { key: "holidays.state" } });
  const state = stateCfg?.value ?? "NW";
  const stateFn = STATE_HOLIDAYS[state];
  if (stateFn) {
    for (const h of stateFn(year)) {
      if (h.date) holidays.add(h.date);
    }
  }

  // Custom holidays from settings
  const customCfg = await db.systemConfig.findUnique({ where: { key: "holidays.customDays" } });
  if (customCfg?.value) {
    try {
      const custom: Array<{ date: string }> = JSON.parse(customCfg.value);
      for (const h of custom) {
        if (h.date?.startsWith(String(year))) holidays.add(h.date);
      }
    } catch { /* ignore parse errors */ }
  }

  return holidays;
}

/**
 * Count working days in a range, excluding weekends AND holidays.
 */
export function countWorkingDaysExcludingHolidays(
  from: Date,
  to: Date,
  holidays: Set<string>
): number {
  let count = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (d <= end) {
    if (!isWeekend(d)) {
      if (!holidays.has(fmt(d))) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}
