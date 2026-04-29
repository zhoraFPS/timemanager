import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { calcNetMins } from "@/lib/working-time";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, format } from "date-fns";

/**
 * DATEV Lohn und Gehalt Export
 * Aggregated monthly hours per employee per Lohnart.
 * Format: Mandantennr;Beraternr;Personalnr;Lohnart;Monat;Stunden_Gesamt;Tage
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
      name: true,
      timeEntries: {
        where: {
          clockIn: { gte: monthStart, lte: monthEnd },
          clockOut: { not: null },
        },
        select: { clockIn: true, clockOut: true, type: true },
      },
    },
    orderBy: { employeeNumber: "asc" },
  });

  const sep = ";";
  const header = [
    "Mandantennummer", "Beraternummer", "Personalnummer",
    "Lohnart", "Abrechnungsmonat", "Stunden_Gesamt", "Tage",
  ].join(sep);

  const rows: string[] = [];
  const abrechnungsmonat = `${String(month).padStart(2, "0")}/${year}`;

  for (const user of users) {
    if (!user.employeeNumber) continue;

    // Aggregate hours by Lohnart
    const byLohnart = new Map<string, { hours: number; days: Set<string> }>();

    for (const entry of user.timeEntries) {
      const lohnartKey = `datev.lohnart.${entry.type}`;
      const lohnart = datevSettings[lohnartKey] ?? "";
      if (!lohnart) continue;

      const netMins = calcNetMins(
        new Date(entry.clockIn),
        new Date(entry.clockOut!),
        { autoBreak, breakAfterHours, breakMinutes }
      );

      const existing = byLohnart.get(lohnart) ?? { hours: 0, days: new Set<string>() };
      existing.hours += netMins / 60;
      existing.days.add(format(new Date(entry.clockIn), "yyyy-MM-dd"));
      byLohnart.set(lohnart, existing);
    }

    for (const [lohnart, data] of byLohnart) {
      rows.push([
        mandantennr, beraternr, user.employeeNumber,
        lohnart, abrechnungsmonat,
        data.hours.toFixed(2), data.days.size.toString(),
      ].join(sep));
    }
  }

  const monthLabel = format(monthStart, "yyyy-MM");
  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datev-lug-${monthLabel}.csv"`,
    },
  });
}
