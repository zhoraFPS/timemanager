import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { calcNetMins } from "@/lib/working-time";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, format } from "date-fns";

/**
 * DATEV IBL-Bewegungssaetze Export (Kostenrechnung classic)
 * ASCII fixed-width format for cost center allocation.
 * Format per line: Mandantennr;Kostenstelle;Lohnart;Personalnr;Datum;Stunden;Betrag
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

  // Break config
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
      dept: { select: { kostenstelleNr: true } },
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
    "Mandantennummer", "Beraternummer", "Kostenstelle",
    "Lohnart", "Personalnummer", "Datum", "Stunden",
  ].join(sep);

  const rows: string[] = [];

  for (const user of users) {
    if (!user.employeeNumber) continue;
    const kostenstelle = user.dept?.kostenstelleNr ?? "";

    for (const entry of user.timeEntries) {
      const lohnartKey = `datev.lohnart.${entry.type}`;
      const lohnart = datevSettings[lohnartKey] ?? "";
      if (!lohnart) continue;

      const netMins = calcNetMins(
        new Date(entry.clockIn),
        new Date(entry.clockOut!),
        { autoBreak, breakAfterHours, breakMinutes }
      );
      const hours = (netMins / 60).toFixed(2);
      const datum = format(new Date(entry.clockIn), "dd.MM.yyyy");

      rows.push([
        mandantennr, beraternr, kostenstelle,
        lohnart, user.employeeNumber, datum, hours,
      ].join(sep));
    }
  }

  const monthLabel = format(monthStart, "yyyy-MM");
  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datev-ibl-${monthLabel}.csv"`,
    },
  });
}
