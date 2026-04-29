import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import { calcNetMins } from "@/lib/working-time";
import { getHolidayDates, countWorkingDaysExcludingHolidays } from "@/lib/holidays";

/**
 * Admin/HR employee overview with flextime saldo + vacation balance.
 * Permission: employees.read with scope "all" required.
 *
 * Returns all active employees with:
 *   - name, email, department, contractType, employeeNumber
 *   - current cumulative flextime saldo (minutes)
 *   - vacation balance (total, used, remaining)
 */
export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(sessionUser.id, "employees", "read", "all");
  if (!canRead)
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  // Break config (same as flextime route)
  const breakConfigs = await db.systemConfig.findMany({
    where: {
      key: {
        in: [
          "workday.autoBreakEnabled",
          "workday.autoBreakAfterHours",
          "workday.autoBreakMinutes",
        ],
      },
    },
  });
  const breakCfg = Object.fromEntries(breakConfigs.map((c) => [c.key, c.value]));
  const autoBreak = breakCfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(breakCfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(breakCfg["workday.autoBreakMinutes"] ?? "30");

  // Fetch all active users
  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      departmentId: true,
      employeeNumber: true,
      contractType: true,
      initialBalance: true,
      startDate: true,
      dept: { select: { name: true } },
      workingTimeConfig: { select: { hoursPerDay: true } },
    },
    orderBy: { name: "asc" },
  });

  // Current month range for saldo calculation (last 12 months)
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const firstMonth = addMonths(currentMonth, -11);

  // Fetch ALL time entries for all users in range (batch query)
  const allEntries = await db.timeEntry.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      clockIn: { gte: firstMonth },
      clockOut: { not: null },
    },
    select: { userId: true, clockIn: true, clockOut: true },
  });

  // Fetch ALL approved overtime-reduce requests
  const allOvertimeReduces = await db.request.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      type: "OVERTIME_REDUCE",
      status: "APPROVED",
      dateFrom: { gte: firstMonth },
    },
    select: { userId: true, dateFrom: true, dateTo: true },
  });

  // Fetch vacation balances: approved VACATION requests this year
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const allVacationRequests = await db.request.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      type: "VACATION",
      status: { in: ["APPROVED", "PENDING"] },
      dateFrom: { gte: yearStart },
    },
    select: { userId: true, dateFrom: true, dateTo: true, status: true },
  });

  // Vacation settings
  const vacationSetting = await db.systemConfig.findFirst({
    where: { key: "vacation.defaultDays" },
  });
  const defaultVacationDays = parseInt(vacationSetting?.value ?? "28");

  // Holiday sets
  const holidays = await getHolidayDates(now.getFullYear());
  const prevYearHolidays = await getHolidayDates(now.getFullYear() - 1);
  const holidaysByYear = new Map<number, Set<string>>();
  holidaysByYear.set(now.getFullYear(), holidays);
  holidaysByYear.set(now.getFullYear() - 1, prevYearHolidays);

  // Build result per user
  const employees = users.map((user) => {
    const hoursPerDay = user.workingTimeConfig?.hoursPerDay ?? 8;

    // ---- Flextime saldo ----
    const userEntries = allEntries.filter((e) => e.userId === user.id);
    const userOvertimeReduces = allOvertimeReduces.filter(
      (r) => r.userId === user.id
    );
    let cumulative = Math.round((user.initialBalance ?? 0) * 60);

    for (let i = 0; i < 12; i++) {
      const mStart = addMonths(firstMonth, i);
      const mEnd = endOfMonth(mStart);
      const y = mStart.getFullYear();
      const hols = holidaysByYear.get(y) ?? new Set<string>();

      const userStart = user.startDate ? new Date(user.startDate) : null;
      if (userStart && mEnd < userStart) continue;

      const rangeStart =
        userStart && userStart > mStart ? userStart : mStart;
      const workingDays = countWorkingDaysExcludingHolidays(
        rangeStart,
        mEnd,
        hols
      );
      const targetMins = workingDays * hoursPerDay * 60;

      const stampedMins = userEntries
        .filter((e) => {
          const ci = new Date(e.clockIn);
          return ci >= mStart && ci <= mEnd;
        })
        .reduce(
          (sum, e) =>
            sum +
            calcNetMins(new Date(e.clockIn), new Date(e.clockOut!), {
              autoBreak,
              breakAfterHours,
              breakMinutes,
            }),
          0
        );

      const overtimeReduceMins = userOvertimeReduces.reduce((sum, req) => {
        const from = new Date(req.dateFrom);
        const to = new Date(req.dateTo);
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
      cumulative += actualMins - targetMins;
    }

    // ---- Vacation balance ----
    const userVacationReqs = allVacationRequests.filter(
      (r) => r.userId === user.id
    );

    function countVacationDays(
      reqs: typeof userVacationReqs,
      statusFilter?: string
    ) {
      return reqs
        .filter((r) => !statusFilter || r.status === statusFilter)
        .reduce((sum, r) => {
          const from = new Date(r.dateFrom);
          const to = new Date(r.dateTo);
          let days = 0;
          const d = new Date(from);
          d.setHours(0, 0, 0, 0);
          while (d <= to) {
            if (d.getDay() !== 0 && d.getDay() !== 6) days++;
            d.setDate(d.getDate() + 1);
          }
          return sum + days;
        }, 0);
    }

    const vacationUsed = countVacationDays(userVacationReqs, "APPROVED");
    const vacationPending = countVacationDays(userVacationReqs, "PENDING");
    const vacationRemaining = defaultVacationDays - vacationUsed;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.dept?.name ?? user.department ?? "",
      employeeNumber: user.employeeNumber ?? "",
      contractType: user.contractType,
      saldoMins: cumulative,
      vacationTotal: defaultVacationDays,
      vacationUsed,
      vacationPending,
      vacationRemaining,
    };
  });

  return NextResponse.json({ employees });
}
