import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { calcNetMins } from "@/lib/working-time";
import { getHolidayDates, countWorkingDaysExcludingHolidays } from "@/lib/holidays";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const now = new Date();

  // User + individuelle Arbeitszeitkonfiguration laden
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { workingTimeConfig: true },
  });

  const hoursPerDay = user?.workingTimeConfig?.hoursPerDay ?? 8;
  const breakMinutesConfig = user?.workingTimeConfig?.breakMinutes ?? 30;
  const vacationTotal = user?.workingTimeConfig?.vacationDays ?? 28;

  // Pausenabzug-Einstellungen aus SystemConfig
  const breakConfigs = await db.systemConfig.findMany({
    where: { key: { in: ["workday.autoBreakEnabled", "workday.autoBreakAfterHours", "workday.autoBreakMinutes"] } },
  });
  const breakCfg = Object.fromEntries(breakConfigs.map((c) => [c.key, c.value]));
  const autoBreak = breakCfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(breakCfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(breakCfg["workday.autoBreakMinutes"] ?? "30");

  // startDate-aware Soll-Berechnung:
  // Zähle Arbeitstage ab max(startDate, Monatsanfang) bis heute
  const monthStart = startOfMonth(now);
  const userStartDate = user?.startDate ? new Date(user.startDate) : null;
  const rangeStart =
    userStartDate && userStartDate > monthStart ? userStartDate : monthStart;

  const holidays = await getHolidayDates(now.getFullYear());
  const workingDays = countWorkingDaysExcludingHolidays(rangeStart, now, holidays);
  const targetMins = workingDays * hoursPerDay * 60;

  // Ist-Zeit: Einträge seit rangeStart
  const monthEntries = await db.timeEntry.findMany({
    where: {
      userId,
      clockIn: { gte: rangeStart, lte: endOfMonth(now) },
      clockOut: { not: null },
    },
  });

  const actualMins = monthEntries.reduce((sum, e) => {
    return sum + calcNetMins(
      new Date(e.clockIn),
      new Date(e.clockOut!),
      { autoBreak, breakAfterHours, breakMinutes }
    );
  }, 0);

  // Resturlaub
  const approvedVacation = await db.request.count({
    where: {
      userId,
      type: "VACATION",
      status: "APPROVED",
      dateFrom: { gte: new Date(now.getFullYear(), 0, 1) },
    },
  });
  const vacationLeft = Math.max(0, vacationTotal - approvedVacation);

  // Team-Status heute
  // - Has department → show all department colleagues
  // - No department but is admin/HR → show all active employees
  // - No department, no admin → show direct reports
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { name: true } } },
  });
  const isAdminOrHR = userRoles.some(
    (ur) => ur.role.name === "SUPERADMIN" || ur.role.name === "HR_ADMIN"
  );

  const teamFilter = user?.departmentId
    ? { departmentId: user.departmentId, isActive: true }
    : isAdminOrHR
      ? { isActive: true }
      : { OR: [{ managerId: userId }, { id: userId }], isActive: true };

  // Presence window: 16h back covers day + night shifts, but filters forgotten
  // clock-ins from 2+ days ago (those should be picked up by auto-clockout and
  // marked as "Offener Stempel > 2h" for HR review).
  const presenceWindowStart = new Date(now.getTime() - 16 * 60 * 60 * 1000);
  const teamMembers = await db.user.findMany({
    where: teamFilter,
    select: {
      id: true,
      name: true,
      timeEntries: {
        where: { clockIn: { gte: presenceWindowStart, lte: endOfDay(now) } },
        orderBy: { clockIn: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  // Offene Anträge
  const pendingRequests = await db.request.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, type: true, dateFrom: true, status: true },
  });

  return NextResponse.json({
    timeAccount: { actualMins, targetMins, vacationLeft, vacationTotal },
    team: teamMembers.map((m) => {
      const isActive = m.timeEntries[0]?.clockOut === null;
      return {
        id: m.id,
        name: m.name,
        // Stamp type visible to everyone (same as mobile app)
        // Privacy only applies to absence REASONS, not attendance stamps
        activeType: isActive ? (m.timeEntries[0]?.type ?? null) : null,
      };
    }),
    pendingRequests,
    debug: {
      workingDays,
      rangeStart: rangeStart.toISOString(),
      hoursPerDay,
      autoBreak,
      breakAfterHours,
      breakMinutes,
    },
  });
}
