import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";
import { loadSurchargeConfig, calcSurcharges, aggregateSurcharges, type SurchargeBreakdown } from "@/lib/surcharges";
import { getHolidayDates } from "@/lib/holidays";

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

  const cfg = await loadSurchargeConfig();
  const holidays = await getHolidayDates(year);

  let userFilter: object = {};
  if (scope === "own") {
    userFilter = { id: session.user.id };
  } else if (scope === "team") {
    userFilter = { OR: [{ id: session.user.id }, { managerId: session.user.id }] };
  }

  const users = await db.user.findMany({
    where: { isActive: true, ...userFilter },
    select: {
      id: true,
      name: true,
      employeeNumber: true,
      dept: { select: { name: true } },
      timeEntries: {
        where: {
          clockIn: { gte: monthStart, lte: monthEnd },
          clockOut: { not: null },
        },
        select: { clockIn: true, clockOut: true },
        orderBy: { clockIn: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = users.map((user) => {
    const breakdowns = user.timeEntries.map((e) =>
      calcSurcharges(new Date(e.clockIn), new Date(e.clockOut!), cfg, holidays)
    );
    const agg = aggregateSurcharges(breakdowns);
    const totalSurchargeMins =
      agg.nightMins + agg.saturdayMins + agg.sundayMins + agg.holidayMins;

    return {
      userId: user.id,
      name: user.name,
      employeeNumber: user.employeeNumber,
      department: user.dept?.name ?? null,
      ...agg,
      totalSurchargeMins,
    };
  });

  return NextResponse.json({ year, month, config: cfg, rows });
}
