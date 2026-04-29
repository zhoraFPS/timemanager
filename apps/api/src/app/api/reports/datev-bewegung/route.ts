import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { calcNetMins } from "@/lib/working-time";
import { loadSurchargeConfig, calcSurcharges } from "@/lib/surcharges";
import { getHolidayDates } from "@/lib/holidays";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, format } from "date-fns";

/**
 * DATEV LODAS Bewegungsdaten-Export
 * Format: Mandantennr;Beraternr;Personalnr;Lohnart;Datum;Stunden
 * One row per time entry per employee, mapped to DATEV Lohnart numbers.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canExport = await hasPermission(session.user.id, "reports", "export");
  if (!canExport) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const datevSettings = await getSettings("datev");
  const mandantennr = datevSettings["datev.mandantennr"] ?? "";
  const beraternr = datevSettings["datev.beraternr"] ?? "";

  // Break config for net hours calculation
  const breakConfigs = await db.systemConfig.findMany({
    where: { key: { in: ["workday.autoBreakEnabled", "workday.autoBreakAfterHours", "workday.autoBreakMinutes"] } },
  });
  const breakCfg = Object.fromEntries(breakConfigs.map((c) => [c.key, c.value]));
  const autoBreak = breakCfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(breakCfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(breakCfg["workday.autoBreakMinutes"] ?? "30");

  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      employeeNumber: true,
      name: true,
      timeEntries: {
        where: {
          clockIn: { gte: monthStart, lte: monthEnd },
          clockOut: { not: null },
        },
        select: { clockIn: true, clockOut: true, type: true },
        orderBy: { clockIn: "asc" },
      },
    },
    orderBy: { employeeNumber: "asc" },
  });

  const sep = ";";
  const header = [
    "Mandantennummer", "Beraternummer", "Personalnummer",
    "Lohnart", "Datum", "Stunden",
  ].join(sep);

  // Surcharge config + holidays for surcharge rows
  const surchargeCfg = await loadSurchargeConfig();
  const holidays = await getHolidayDates(year);

  // DATEV Lohnarten for surcharges (configurable via settings)
  const nightLohnart = datevSettings["datev.lohnart.NIGHT_SURCHARGE"] ?? "260";
  const saturdayLohnart = datevSettings["datev.lohnart.SATURDAY_SURCHARGE"] ?? "261";
  const sundayLohnart = datevSettings["datev.lohnart.SUNDAY_SURCHARGE"] ?? "262";
  const holidayLohnart = datevSettings["datev.lohnart.HOLIDAY_SURCHARGE"] ?? "263";

  const rows: string[] = [];

  for (const user of users) {
    if (!user.employeeNumber) continue;

    for (const entry of user.timeEntries) {
      const lohnartKey = `datev.lohnart.${entry.type}`;
      const lohnart = datevSettings[lohnartKey] ?? "";
      if (!lohnart) continue;

      const clockIn = new Date(entry.clockIn);
      const clockOut = new Date(entry.clockOut!);

      const netMins = calcNetMins(clockIn, clockOut, { autoBreak, breakAfterHours, breakMinutes });
      const hours = (netMins / 60).toFixed(2);
      const datum = format(clockIn, "dd.MM.yyyy");

      // Normal work row
      rows.push([mandantennr, beraternr, user.employeeNumber, lohnart, datum, hours].join(sep));

      // Surcharge rows
      const sc = calcSurcharges(clockIn, clockOut, surchargeCfg, holidays);

      if (sc.nightMins > 0) {
        rows.push([mandantennr, beraternr, user.employeeNumber, nightLohnart, datum, (sc.nightMins / 60).toFixed(2)].join(sep));
      }
      if (sc.saturdayMins > 0) {
        rows.push([mandantennr, beraternr, user.employeeNumber, saturdayLohnart, datum, (sc.saturdayMins / 60).toFixed(2)].join(sep));
      }
      if (sc.sundayMins > 0) {
        rows.push([mandantennr, beraternr, user.employeeNumber, sundayLohnart, datum, (sc.sundayMins / 60).toFixed(2)].join(sep));
      }
      if (sc.holidayMins > 0) {
        rows.push([mandantennr, beraternr, user.employeeNumber, holidayLohnart, datum, (sc.holidayMins / 60).toFixed(2)].join(sep));
      }
    }
  }

  const monthLabel = format(monthStart, "yyyy-MM");
  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datev-bewegung-${monthLabel}.csv"`,
    },
  });
}
