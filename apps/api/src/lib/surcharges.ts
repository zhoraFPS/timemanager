import { getSettings } from "@/lib/settings";
import { getHolidayDates } from "@/lib/holidays";
import { format } from "date-fns";

export interface SurchargeConfig {
  nightEnabled: boolean;
  nightStart: string; // "HH:MM"
  nightEnd: string;
  nightPercent: number;
  weekendEnabled: boolean;
  saturdayPercent: number;
  sundayPercent: number;
  holidayEnabled: boolean;
  holidayPercent: number;
}

export interface SurchargeBreakdown {
  normalMins: number;
  nightMins: number;
  nightPercent: number;
  saturdayMins: number;
  saturdayPercent: number;
  sundayMins: number;
  sundayPercent: number;
  holidayMins: number;
  holidayPercent: number;
}

export async function loadSurchargeConfig(): Promise<SurchargeConfig> {
  const s = await getSettings("surcharge");
  return {
    nightEnabled: s["surcharge.nightEnabled"] === "true",
    nightStart: s["surcharge.nightStart"] ?? "20:00",
    nightEnd: s["surcharge.nightEnd"] ?? "06:00",
    nightPercent: parseFloat(s["surcharge.nightPercent"] ?? "25"),
    weekendEnabled: s["surcharge.weekendEnabled"] === "true",
    saturdayPercent: parseFloat(s["surcharge.saturdayPercent"] ?? "25"),
    sundayPercent: parseFloat(s["surcharge.sundayPercent"] ?? "50"),
    holidayEnabled: s["surcharge.holidayEnabled"] === "true",
    holidayPercent: parseFloat(s["surcharge.holidayPercent"] ?? "100"),
  };
}

/**
 * Parse "HH:MM" into minutes since midnight.
 */
function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Check if a given minute-of-day falls in the night window.
 * Night window can wrap around midnight (e.g. 20:00-06:00).
 */
function isNightMinute(minuteOfDay: number, nightStartMin: number, nightEndMin: number): boolean {
  if (nightStartMin > nightEndMin) {
    // Wraps midnight: 20:00-06:00 means 20:00-23:59 OR 00:00-06:00
    return minuteOfDay >= nightStartMin || minuteOfDay < nightEndMin;
  }
  return minuteOfDay >= nightStartMin && minuteOfDay < nightEndMin;
}

/**
 * Calculate surcharge breakdown for a single time entry.
 * Walks minute-by-minute through the entry to classify each minute.
 */
export function calcSurcharges(
  clockIn: Date,
  clockOut: Date,
  cfg: SurchargeConfig,
  holidays: Set<string>
): SurchargeBreakdown {
  const result: SurchargeBreakdown = {
    normalMins: 0,
    nightMins: 0,
    nightPercent: cfg.nightPercent,
    saturdayMins: 0,
    saturdayPercent: cfg.saturdayPercent,
    sundayMins: 0,
    sundayPercent: cfg.sundayPercent,
    holidayMins: 0,
    holidayPercent: cfg.holidayPercent,
  };

  const nightStartMin = parseTime(cfg.nightStart);
  const nightEndMin = parseTime(cfg.nightEnd);
  const totalMins = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000);
  if (totalMins <= 0) return result;

  const cursor = new Date(clockIn);

  for (let i = 0; i < totalMins; i++) {
    const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat
    const dateStr = format(cursor, "yyyy-MM-dd");
    const minuteOfDay = cursor.getHours() * 60 + cursor.getMinutes();

    let classified = false;

    // Holiday takes highest priority
    if (cfg.holidayEnabled && holidays.has(dateStr)) {
      result.holidayMins++;
      classified = true;
    }
    // Sunday
    else if (cfg.weekendEnabled && dayOfWeek === 0) {
      result.sundayMins++;
      classified = true;
    }
    // Saturday
    else if (cfg.weekendEnabled && dayOfWeek === 6) {
      result.saturdayMins++;
      classified = true;
    }

    // Night surcharge stacks with weekend/holiday — count separately
    if (cfg.nightEnabled && isNightMinute(minuteOfDay, nightStartMin, nightEndMin)) {
      result.nightMins++;
      if (!classified) classified = true;
    }

    if (!classified) {
      result.normalMins++;
    }

    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return result;
}

/**
 * Aggregate multiple breakdowns into one.
 */
export function aggregateSurcharges(breakdowns: SurchargeBreakdown[]): SurchargeBreakdown {
  const agg: SurchargeBreakdown = {
    normalMins: 0, nightMins: 0, nightPercent: 0,
    saturdayMins: 0, saturdayPercent: 0,
    sundayMins: 0, sundayPercent: 0,
    holidayMins: 0, holidayPercent: 0,
  };
  for (const b of breakdowns) {
    agg.normalMins += b.normalMins;
    agg.nightMins += b.nightMins;
    agg.saturdayMins += b.saturdayMins;
    agg.sundayMins += b.sundayMins;
    agg.holidayMins += b.holidayMins;
    agg.nightPercent = b.nightPercent;
    agg.saturdayPercent = b.saturdayPercent;
    agg.sundayPercent = b.sundayPercent;
    agg.holidayPercent = b.holidayPercent;
  }
  return agg;
}
