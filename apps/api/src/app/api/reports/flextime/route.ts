import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import { calcNetMins } from "@/lib/working-time";
import { getHolidayDates, countWorkingDaysExcludingHolidays } from "@/lib/holidays";

/**
 * Gleitzeitkonto: laufender Saldo pro Monat mit kumulativem Uebertrag.
 * ?userId=xxx (optional, fuer HR/Manager)
 * ?months=12 (default 12)
 */
export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId") ?? sessionUser.id;
  const monthCount = Math.min(parseInt(searchParams.get("months") ?? "12"), 24);

  // Permission check
  if (targetUserId !== sessionUser.id) {
    const canRead = await hasPermission(sessionUser.id, "reports", "read");
    if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    const scope = await getPermissionScope(sessionUser.id, "reports", "read");
    if (scope === "own") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    if (scope === "team") {
      const isTeamMember = await db.user.findFirst({
        where: { id: targetUserId, managerId: sessionUser.id },
      });
      if (!isTeamMember) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
  }

  const user = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      employeeNumber: true,
      startDate: true,
      initialBalance: true,
      workingTimeConfig: { select: { hoursPerDay: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });

  // Break + go-live config
  const systemConfigs = await db.systemConfig.findMany({
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
  const cfg = Object.fromEntries(systemConfigs.map((c) => [c.key, c.value]));
  const autoBreak = cfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(cfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(cfg["workday.autoBreakMinutes"] ?? "30");

  // Go-live-Date: alles davor wird ignoriert (weder Soll noch Ist). Leerer
  // Wert / ungueltiges Datum = kein Cutoff, es gilt nur user.startDate.
  const goLiveRaw = cfg["workday.goLiveDate"];
  const goLiveDate = goLiveRaw ? new Date(goLiveRaw) : null;
  const hasGoLive = goLiveDate && !isNaN(goLiveDate.getTime());

  const hoursPerDay = user.workingTimeConfig?.hoursPerDay ?? 8;
  const now = new Date();
  const currentMonth = startOfMonth(now);

  // Calculate months range
  const firstMonth = addMonths(currentMonth, -(monthCount - 1));

  // Fetch all time entries in range
  const entries = await db.timeEntry.findMany({
    where: {
      userId: targetUserId,
      clockIn: { gte: firstMonth },
      clockOut: { not: null },
    },
    select: { clockIn: true, clockOut: true },
    orderBy: { clockIn: "asc" },
  });

  // Fetch approved OVERTIME_REDUCE requests in range — these days count as
  // "worked at target hours" so the flex balance is not reduced
  const overtimeReduceRequests = await db.request.findMany({
    where: {
      userId: targetUserId,
      type: "OVERTIME_REDUCE",
      status: "APPROVED",
      dateFrom: { gte: firstMonth },
    },
    select: { dateFrom: true, dateTo: true },
  });

  // Build monthly data
  const months: Array<{
    year: number;
    month: number;
    targetMins: number;
    actualMins: number;
    saldoMins: number;
    cumulativeMins: number;
  }> = [];

  let cumulative = Math.round((user.initialBalance ?? 0) * 60); // initialBalance is in hours

  // Collect holiday sets for all relevant years
  const years = new Set<number>();
  for (let i = 0; i < monthCount; i++) {
    const ms = addMonths(firstMonth, i);
    years.add(ms.getFullYear());
  }
  const holidaysByYear = new Map<number, Set<string>>();
  for (const yr of years) {
    holidaysByYear.set(yr, await getHolidayDates(yr));
  }

  for (let i = 0; i < monthCount; i++) {
    const mStart = addMonths(firstMonth, i);
    const mEnd = endOfMonth(mStart);
    const y = mStart.getFullYear();
    const m = mStart.getMonth() + 1;
    const holidays = holidaysByYear.get(y)!;

    const userStart = user.startDate ? new Date(user.startDate) : null;

    // Effective start = latest of (go-live, user startDate, month start).
    // Months entirely before that date produce no target and no actual —
    // cumulative stays where it is (= initialBalance at the start).
    const effectiveStart =
      hasGoLive && (!userStart || goLiveDate! > userStart) ? goLiveDate! : userStart;

    if (effectiveStart && mEnd < effectiveStart) {
      months.push({ year: y, month: m, targetMins: 0, actualMins: 0, saldoMins: 0, cumulativeMins: cumulative });
      continue;
    }

    const rangeStart = effectiveStart && effectiveStart > mStart ? effectiveStart : mStart;
    const workingDays = countWorkingDaysExcludingHolidays(rangeStart, mEnd, holidays);
    const targetMins = workingDays * hoursPerDay * 60;

    // Sum actual hours for this month from time entries — only entries on or
    // after the effective-start date are counted so the ramp-up stays clean.
    const stampedMins = entries
      .filter((e) => {
        const ci = new Date(e.clockIn);
        if (ci < mStart || ci > mEnd) return false;
        if (effectiveStart && ci < effectiveStart) return false;
        return true;
      })
      .reduce((sum, e) => {
        return sum + calcNetMins(
          new Date(e.clockIn),
          new Date(e.clockOut!),
          { autoBreak, breakAfterHours, breakMinutes }
        );
      }, 0);

    // Credit approved OVERTIME_REDUCE days: each working day counts as
    // hoursPerDay worked so it doesn't reduce the flex balance
    const overtimeReduceMins = overtimeReduceRequests.reduce((sum, req) => {
      const from = new Date(req.dateFrom);
      const to = new Date(req.dateTo);
      // Clamp to this month
      const rangeFrom = from < mStart ? mStart : from;
      const rangeTo = to > mEnd ? mEnd : to;
      if (rangeFrom > rangeTo) return sum;
      let days = 0;
      const d = new Date(rangeFrom);
      d.setHours(0, 0, 0, 0);
      while (d <= rangeTo) {
        if (d.getDay() !== 0 && d.getDay() !== 6) days++;
        d.setDate(d.getDate() + 1);
      }
      return sum + days * hoursPerDay * 60;
    }, 0);

    const actualMins = stampedMins + overtimeReduceMins;

    const saldoMins = actualMins - targetMins;
    cumulative += saldoMins;

    months.push({ year: y, month: m, targetMins, actualMins, saldoMins, cumulativeMins: cumulative });
  }

  return NextResponse.json({
    userId: user.id,
    name: user.name,
    employeeNumber: user.employeeNumber,
    initialBalanceHours: user.initialBalance ?? 0,
    hoursPerDay,
    months,
  });
}
