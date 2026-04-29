import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, isWeekend, format } from "date-fns";
import { calcNetMins } from "@/lib/working-time";
import { getSettings } from "@/lib/settings";

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

  // Export settings
  const exportSettings = await getSettings("export");
  const separator = exportSettings["export.csvSeparator"] ?? ";";
  const dateFormat = exportSettings["export.csvDateFormat"] ?? "dd.MM.yyyy";

  // Break settings
  const breakConfigs = await db.systemConfig.findMany({
    where: { key: { in: ["workday.autoBreakEnabled", "workday.autoBreakAfterHours", "workday.autoBreakMinutes"] } },
  });
  const breakCfg = Object.fromEntries(breakConfigs.map((c) => [c.key, c.value]));
  const autoBreak = breakCfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(breakCfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(breakCfg["workday.autoBreakMinutes"] ?? "30");

  // Working days
  let workingDaysInMonth = 0;
  const current = new Date(monthStart);
  while (current <= monthEnd) {
    if (!isWeekend(current)) workingDaysInMonth++;
    current.setDate(current.getDate() + 1);
  }

  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      name: true,
      employeeNumber: true,
      dept: { select: { name: true } },
      contractType: true,
      startDate: true,
      workingTimeConfig: { select: { hoursPerDay: true } },
      timeEntries: {
        where: {
          clockIn: { gte: monthStart, lte: monthEnd },
          clockOut: { not: null },
        },
        select: { clockIn: true, clockOut: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Build CSV
  const header = [
    "Personalnummer", "Name", "Abteilung", "Vertragsart",
    "Soll (h)", "Ist (h)", "Saldo (h)", "Arbeitstage",
  ].join(separator);

  const rows = users.map((user) => {
    const hoursPerDay = user.workingTimeConfig?.hoursPerDay ?? 8;
    const userStart = user.startDate ? new Date(user.startDate) : null;
    let effectiveWorkingDays = workingDaysInMonth;
    if (userStart && userStart > monthStart) {
      effectiveWorkingDays = 0;
      const d = new Date(userStart);
      d.setHours(0, 0, 0, 0);
      while (d <= monthEnd) {
        if (!isWeekend(d)) effectiveWorkingDays++;
        d.setDate(d.getDate() + 1);
      }
    }

    const targetMins = effectiveWorkingDays * hoursPerDay * 60;
    const actualMins = user.timeEntries.reduce((sum, e) => {
      return sum + calcNetMins(
        new Date(e.clockIn),
        new Date(e.clockOut!),
        { autoBreak, breakAfterHours, breakMinutes }
      );
    }, 0);
    const saldoMins = actualMins - targetMins;
    const daysWorked = new Set(
      user.timeEntries.map((e) => format(new Date(e.clockIn), "yyyy-MM-dd"))
    ).size;

    return [
      user.employeeNumber ?? "",
      user.name,
      user.dept?.name ?? "",
      user.contractType,
      (targetMins / 60).toFixed(2),
      (actualMins / 60).toFixed(2),
      (saldoMins / 60).toFixed(2),
      daysWorked.toString(),
    ].join(separator);
  });

  const monthLabel = format(monthStart, "yyyy-MM");
  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auswertung-${monthLabel}.csv"`,
    },
  });
}
