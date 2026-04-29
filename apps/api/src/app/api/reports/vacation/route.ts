import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "reports", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const scope = await getPermissionScope(session.user.id, "reports", "read");
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  let userFilter: object = {};
  if (scope === "own") {
    userFilter = { id: session.user.id };
  } else if (scope === "team") {
    userFilter = {
      OR: [{ id: session.user.id }, { managerId: session.user.id }],
    };
  }

  // Carryover settings
  const carryoverCfg = await db.systemConfig.findMany({
    where: { key: { in: ["vacation.carryoverEnabled", "vacation.carryoverMonth", "vacation.carryoverDay"] } },
  });
  const coCfg = Object.fromEntries(carryoverCfg.map((c) => [c.key, c.value]));
  const carryoverEnabled = coCfg["vacation.carryoverEnabled"] === "true";
  const carryoverMonth = parseInt(coCfg["vacation.carryoverMonth"] ?? "3");
  const carryoverDay = parseInt(coCfg["vacation.carryoverDay"] ?? "31");

  const users = await db.user.findMany({
    where: { isActive: true, ...userFilter },
    select: {
      id: true,
      name: true,
      employeeNumber: true,
      dept: { select: { name: true } },
      workingTimeConfig: { select: { vacationDays: true } },
      requests: {
        where: {
          type: { in: ["VACATION", "SICK", "SPECIAL_LEAVE"] },
          OR: [
            { dateFrom: { gte: new Date(year - 1, 0, 1) }, dateTo: { lte: new Date(year, 11, 31) } },
          ],
        },
        select: { status: true, type: true, dateFrom: true, dateTo: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Count working days in a date range (exclude weekends)
  function countWorkingDaysInRange(from: Date, to: Date): number {
    let count = 0;
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  const rows = users.map((user) => {
    const totalDays = user.workingTimeConfig?.vacationDays ?? 28;

    const thisYearVacation = user.requests.filter(
      (r) => r.type === "VACATION" && new Date(r.dateFrom).getFullYear() === year
    );
    const approved = thisYearVacation.filter((r) => r.status === "APPROVED");
    const pending = thisYearVacation.filter((r) => r.status === "PENDING");

    const countDays = (reqs: typeof approved) =>
      reqs.reduce((sum, r) => {
        if (!r.dateFrom || !r.dateTo) return sum;
        return sum + countWorkingDaysInRange(new Date(r.dateFrom), new Date(r.dateTo));
      }, 0);

    const usedDays = countDays(approved);
    const pendingDays = countDays(pending);

    // Carryover: unused days from previous year
    let carryoverDays = 0;
    if (carryoverEnabled) {
      const prevYearVacation = user.requests.filter(
        (r) => r.type === "VACATION" && r.status === "APPROVED" && new Date(r.dateFrom).getFullYear() === year - 1
      );
      const prevUsed = countDays(prevYearVacation);
      const prevRemaining = Math.max(0, totalDays - prevUsed);
      // Carryover expires after deadline
      const deadline = new Date(year, carryoverMonth - 1, carryoverDay);
      carryoverDays = new Date() > deadline ? 0 : prevRemaining;
    }

    // Sick days this year
    const sickApproved = user.requests.filter(
      (r) => r.type === "SICK" && r.status === "APPROVED" && new Date(r.dateFrom).getFullYear() === year
    );
    const sickDays = countDays(sickApproved);

    const totalAvailable = totalDays + carryoverDays;
    const remainingDays = Math.max(0, totalAvailable - usedDays);

    return {
      userId: user.id,
      name: user.name,
      employeeNumber: user.employeeNumber,
      department: user.dept?.name ?? null,
      totalDays,
      carryoverDays,
      totalAvailable,
      usedDays,
      pendingDays,
      remainingDays,
      sickDays,
    };
  });

  const carryoverDeadline = carryoverEnabled ? `${carryoverDay}.${carryoverMonth}.${year}` : null;

  return NextResponse.json({ year, carryoverDeadline, rows });
}
