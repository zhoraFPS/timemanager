import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { calcNetMins } from "@/lib/working-time";
import { getHolidayDates, countWorkingDaysExcludingHolidays } from "@/lib/holidays";
import { startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { NextResponse } from "next/server";

type Scalar = number | null;

interface DashboardResponse {
  scope: { year: number; month: number };
  kpis: {
    totalActualHours: Scalar;
    totalTargetHours: Scalar;
    balanceHours: Scalar;
    deltaVsPrevMonth: Scalar;
    activeEmployees: number;
    sickDaysThisMonth: number;
    vacationDaysThisMonth: number;
    pendingApprovals: number;
    pendingCorrections: number;
    openStamps: number;
  };
  monthlyTrend: Array<{ year: number; month: number; actualHours: number; targetHours: number }>;
  topOvertime: Array<{ userId: string; name: string; balanceHours: number }>;
  departmentBreakdown: Array<{ departmentId: string | null; name: string; actualHours: number; targetHours: number }>;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "reports", "read", "all");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));

  // --- Break config (shared)
  const cfgRows = await db.systemConfig.findMany({
    where: {
      key: {
        in: [
          "workday.autoBreakEnabled",
          "workday.autoBreakAfterHours",
          "workday.autoBreakMinutes",
          "workday.goLiveDate",
        ],
      },
    },
  });
  const cfg = Object.fromEntries(cfgRows.map((c) => [c.key, c.value]));
  const autoBreak = cfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(cfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(cfg["workday.autoBreakMinutes"] ?? "30");
  const goLiveDate = cfg["workday.goLiveDate"] ? new Date(cfg["workday.goLiveDate"]) : null;

  // --- Active users (parallel)
  const [users, holidays] = await Promise.all([
    db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        initialBalance: true,
        departmentId: true,
        startDate: true,
        workingTimeConfig: { select: { hoursPerDay: true } },
        dept: { select: { name: true } },
      },
    }),
    getHolidayDates(year),
  ]);

  const activeEmployees = users.length;

  // --- Current-month + previous-month entries
  const [currEntries, prevEntries] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        clockOut: { not: null },
        clockIn: { gte: monthStart, lte: monthEnd },
        userId: { in: users.map((u) => u.id) },
      },
      select: { userId: true, clockIn: true, clockOut: true },
    }),
    db.timeEntry.findMany({
      where: {
        clockOut: { not: null },
        clockIn: { gte: prevStart, lte: prevEnd },
        userId: { in: users.map((u) => u.id) },
      },
      select: { userId: true, clockIn: true, clockOut: true },
    }),
  ]);

  // --- Leave counts this month (approved)
  const approvedLeave = await db.request.findMany({
    where: {
      status: "APPROVED",
      type: { in: ["SICK", "VACATION"] },
      AND: [
        { dateFrom: { lte: monthEnd } },
        { dateTo: { gte: monthStart } },
      ],
    },
    select: { userId: true, type: true, dateFrom: true, dateTo: true },
  });

  function overlapWorkdays(from: Date, to: Date): number {
    const start = from < monthStart ? monthStart : from;
    const end = to > monthEnd ? monthEnd : to;
    return countWorkingDaysExcludingHolidays(start, end, holidays);
  }

  // Kein per-User-Breakdown fuer Krankentage — Datenschutz/Betriebsrat. Nur
  // aggregierte Monatssummen fuer das KPI-Banner.
  let sickDaysTotal = 0;
  let vacationDaysTotal = 0;
  for (const r of approvedLeave) {
    const days = overlapWorkdays(new Date(r.dateFrom), new Date(r.dateTo));
    if (r.type === "SICK") sickDaysTotal += days;
    else vacationDaysTotal += days;
  }

  // --- Sum actual minutes per user (current + previous)
  function sumMinsByUser(rows: { userId: string; clockIn: Date; clockOut: Date | null }[]) {
    const map = new Map<string, number>();
    for (const e of rows) {
      if (!e.clockOut) continue;
      const mins = calcNetMins(e.clockIn, e.clockOut, { autoBreak, breakAfterHours, breakMinutes });
      map.set(e.userId, (map.get(e.userId) ?? 0) + mins);
    }
    return map;
  }
  const currActualMinsByUser = sumMinsByUser(currEntries);
  const prevActualMinsByUser = sumMinsByUser(prevEntries);

  // --- Target per user for a given month (accounting for goLive, startDate, holidays)
  function computeTargetMins(user: (typeof users)[number], mStart: Date, mEnd: Date): number {
    const hpd = user.workingTimeConfig?.hoursPerDay ?? 8;
    const userStart = user.startDate ? new Date(user.startDate) : null;
    const effectiveStart =
      goLiveDate && (!userStart || goLiveDate > userStart) ? goLiveDate : userStart;
    if (effectiveStart && mEnd < effectiveStart) return 0;
    const rangeStart = effectiveStart && effectiveStart > mStart ? effectiveStart : mStart;
    const workdays = countWorkingDaysExcludingHolidays(rangeStart, mEnd, holidays);
    return workdays * hpd * 60;
  }

  // KPI sums (in minutes)
  let totalActualMins = 0;
  let totalTargetMins = 0;
  let prevTotalActualMins = 0;
  for (const u of users) {
    totalActualMins += currActualMinsByUser.get(u.id) ?? 0;
    totalTargetMins += computeTargetMins(u, monthStart, monthEnd);
    prevTotalActualMins += prevActualMinsByUser.get(u.id) ?? 0;
  }

  // --- Top-5 overtime balance (cumulative over history, approximated as
  // initialBalance + current-month delta; full historical calc would be
  // expensive at this scale)
  const userBalanceMins = users.map((u) => {
    const delta = (currActualMinsByUser.get(u.id) ?? 0) - computeTargetMins(u, monthStart, monthEnd);
    const total = Math.round((u.initialBalance ?? 0) * 60) + delta;
    return { userId: u.id, name: u.name, balanceMins: total };
  });
  const topOvertime = [...userBalanceMins]
    .sort((a, b) => b.balanceMins - a.balanceMins)
    .slice(0, 5)
    .map((u) => ({ userId: u.userId, name: u.name, balanceHours: +(u.balanceMins / 60).toFixed(2) }));

  // --- Department breakdown
  const deptMap = new Map<
    string,
    { departmentId: string | null; name: string; actualMins: number; targetMins: number }
  >();
  for (const u of users) {
    const key = u.departmentId ?? "__none__";
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        departmentId: u.departmentId,
        name: u.dept?.name ?? "Ohne Abteilung",
        actualMins: 0,
        targetMins: 0,
      });
    }
    const row = deptMap.get(key)!;
    row.actualMins += currActualMinsByUser.get(u.id) ?? 0;
    row.targetMins += computeTargetMins(u, monthStart, monthEnd);
  }
  const departmentBreakdown = [...deptMap.values()]
    .map((d) => ({
      departmentId: d.departmentId,
      name: d.name,
      actualHours: +(d.actualMins / 60).toFixed(1),
      targetHours: +(d.targetMins / 60).toFixed(1),
    }))
    .sort((a, b) => b.actualHours - a.actualHours);

  // --- Monthly trend: last 12 months (total across all users, SQL-level aggregation
  // would be faster but this is fine for 500 users × 12 months × dozens of entries)
  const trendStart = startOfMonth(subMonths(now, 11));
  const trendEntries = await db.timeEntry.findMany({
    where: {
      clockOut: { not: null },
      clockIn: { gte: trendStart, lte: monthEnd },
      userId: { in: users.map((u) => u.id) },
    },
    select: { userId: true, clockIn: true, clockOut: true },
  });
  const trend: DashboardResponse["monthlyTrend"] = [];
  for (let i = 0; i < 12; i++) {
    const mStart = addMonths(trendStart, i);
    const mEnd = endOfMonth(mStart);
    let actualMins = 0;
    let targetMins = 0;
    for (const e of trendEntries) {
      const ci = new Date(e.clockIn);
      if (ci >= mStart && ci <= mEnd && e.clockOut) {
        actualMins += calcNetMins(ci, new Date(e.clockOut), { autoBreak, breakAfterHours, breakMinutes });
      }
    }
    for (const u of users) {
      targetMins += computeTargetMins(u, mStart, mEnd);
    }
    trend.push({
      year: mStart.getFullYear(),
      month: mStart.getMonth() + 1,
      actualHours: +(actualMins / 60).toFixed(1),
      targetHours: +(targetMins / 60).toFixed(1),
    });
  }

  // --- Compliance: pending approvals, pending corrections, open stamps > 2h
  const [pendingApprovals, pendingCorrections, pendingMissing, openStamps] = await Promise.all([
    db.request.count({ where: { status: "PENDING" } }),
    db.timeEntryEditRequest.count({ where: { status: "PENDING" } }),
    db.missingEntryRequest.count({ where: { status: "PENDING" } }),
    db.timeEntry.count({
      where: {
        clockOut: null,
        clockIn: { lt: new Date(Date.now() - 2 * 3_600_000) },
        userId: { in: users.map((u) => u.id) },
      },
    }),
  ]);

  const response: DashboardResponse = {
    scope: { year, month },
    kpis: {
      totalActualHours: +(totalActualMins / 60).toFixed(1),
      totalTargetHours: +(totalTargetMins / 60).toFixed(1),
      balanceHours: +((totalActualMins - totalTargetMins) / 60).toFixed(1),
      deltaVsPrevMonth:
        prevTotalActualMins > 0
          ? +(((totalActualMins - prevTotalActualMins) / prevTotalActualMins) * 100).toFixed(1)
          : null,
      activeEmployees,
      sickDaysThisMonth: sickDaysTotal,
      vacationDaysThisMonth: vacationDaysTotal,
      pendingApprovals,
      pendingCorrections: pendingCorrections + pendingMissing,
      openStamps,
    },
    monthlyTrend: trend,
    topOvertime,
    departmentBreakdown,
  };

  return NextResponse.json(response);
}
