import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { calcNetMins } from "@/lib/working-time";
import { getHolidayDates, countWorkingDaysExcludingHolidays } from "@/lib/holidays";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "reports", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const scope = await getPermissionScope(session.user.id, "reports", "read");
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  // Break settings
  const breakConfigs = await db.systemConfig.findMany({
    where: { key: { in: ["workday.autoBreakEnabled", "workday.autoBreakAfterHours", "workday.autoBreakMinutes"] } },
  });
  const breakCfg = Object.fromEntries(breakConfigs.map((c) => [c.key, c.value]));
  const autoBreak = breakCfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(breakCfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(breakCfg["workday.autoBreakMinutes"] ?? "30");

  // Determine which users to include based on scope
  let userFilter: object = {};
  if (scope === "own") {
    userFilter = { id: session.user.id };
  } else if (scope === "team") {
    userFilter = {
      OR: [{ id: session.user.id }, { managerId: session.user.id }],
    };
  }
  // scope === "all" -> no filter

  const users = await db.user.findMany({
    where: { isActive: true, ...userFilter },
    select: {
      id: true,
      name: true,
      employeeNumber: true,
      contractType: true,
      startDate: true,
      departmentId: true,
      dept: { select: { name: true } },
      workingTimeConfig: { select: { hoursPerDay: true, vacationDays: true } },
      timeEntries: {
        where: {
          clockIn: { gte: monthStart, lte: monthEnd },
          clockOut: { not: null },
        },
        select: { clockIn: true, clockOut: true, type: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Count working days in month (excluding holidays)
  const holidays = await getHolidayDates(year);
  const workingDaysInMonth = countWorkingDaysExcludingHolidays(monthStart, monthEnd, holidays);

  const rows = users.map((user) => {
    const hoursPerDay = user.workingTimeConfig?.hoursPerDay ?? 8;

    // If user started mid-month, adjust working days
    const userStart = user.startDate ? new Date(user.startDate) : null;
    let effectiveWorkingDays = workingDaysInMonth;
    if (userStart && userStart > monthStart) {
      effectiveWorkingDays = countWorkingDaysExcludingHolidays(userStart, monthEnd, holidays);
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

    return {
      userId: user.id,
      name: user.name,
      employeeNumber: user.employeeNumber,
      department: user.dept?.name ?? null,
      contractType: user.contractType,
      hoursPerDay,
      targetMins,
      actualMins,
      saldoMins,
      daysWorked,
      workingDays: effectiveWorkingDays,
    };
  });

  return NextResponse.json({
    year,
    month,
    workingDaysInMonth,
    rows,
  });
}
