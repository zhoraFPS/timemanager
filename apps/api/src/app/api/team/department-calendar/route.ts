import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import {
  startOfMonth,
  endOfMonth,
  format,
  differenceInMinutes,
} from "date-fns";

/**
 * Department calendar: attendance + absences per day per user.
 *
 * Query params:
 *   ?month=2026-04  (default: current month)
 *
 * Response shape per user:
 *   { userId, name, days: { "2026-04-01": { status, minutesWorked? } } }
 *
 * Privacy rules:
 *   - Normal user: own department only, absences shown as "ABSENT" (no type), no hours
 *   - Manager (team scope): own reports, real absence types, hours in tooltip
 *   - HR/Admin (all scope): all departments, real types, hours
 */
export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");

  const baseDate = monthParam
    ? new Date(`${monthParam}-01T00:00:00`)
    : new Date();
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);

  // Determine viewer's role scope
  const scope = await getPermissionScope(sessionUser.id, "employees", "read");
  const isAdmin = scope === "all";
  const isManager = scope === "team";

  // Get current user's department
  const currentUser = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { departmentId: true },
  });

  // Build user filter based on role
  const userFilter: Record<string, unknown> = { isActive: true };

  if (isAdmin) {
    // Admin sees all — no department filter
  } else if (isManager) {
    // Manager sees own reports + own department
    userFilter.OR = [
      { managerId: sessionUser.id },
      ...(currentUser?.departmentId
        ? [{ departmentId: currentUser.departmentId }]
        : []),
    ];
  } else {
    // Normal user: own department only
    if (!currentUser?.departmentId) {
      return NextResponse.json({ users: [], canSeeDetails: false });
    }
    userFilter.departmentId = currentUser.departmentId;
  }

  // Fetch users
  const users = await db.user.findMany({
    where: userFilter,
    select: {
      id: true,
      name: true,
      department: true,
      departmentId: true,
      dept: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  const userIds = users.map((u) => u.id);

  // Fetch time entries for the month (attendance)
  const timeEntries = await db.timeEntry.findMany({
    where: {
      userId: { in: userIds },
      clockIn: { gte: monthStart, lte: monthEnd },
      clockOut: { not: null },
    },
    select: {
      userId: true,
      clockIn: true,
      clockOut: true,
    },
  });

  // Fetch approved requests for the month (absences)
  const requests = await db.request.findMany({
    where: {
      userId: { in: userIds },
      status: "APPROVED",
      type: { in: ["VACATION", "SICK", "SPECIAL_LEAVE", "HOMEOFFICE", "OVERTIME_REDUCE"] },
      dateFrom: { lte: monthEnd },
      dateTo: { gte: monthStart },
    },
    select: {
      userId: true,
      type: true,
      dateFrom: true,
      dateTo: true,
    },
  });

  // Can this viewer see details (hours + absence types)?
  const canSeeDetails = isAdmin || isManager;

  // Manager's direct report IDs (for granular permission)
  const managerReportIds = isManager
    ? new Set(
        (
          await db.user.findMany({
            where: { managerId: sessionUser.id },
            select: { id: true },
          })
        ).map((u) => u.id)
      )
    : new Set<string>();

  // Build per-user day map
  const result = users.map((user) => {
    const days: Record<
      string,
      { status: "present" | "absent" | null; minutes?: number; absenceType?: string }
    > = {};

    // Can this specific user's details be seen?
    const canSeeUserDetails =
      isAdmin || (isManager && (managerReportIds.has(user.id) || user.id === sessionUser.id));

    // Attendance: group time entries by day
    const userEntries = timeEntries.filter((e) => e.userId === user.id);
    for (const entry of userEntries) {
      const dayKey = format(new Date(entry.clockIn), "yyyy-MM-dd");
      const mins = differenceInMinutes(
        new Date(entry.clockOut!),
        new Date(entry.clockIn)
      );
      if (!days[dayKey]) {
        days[dayKey] = { status: "present", minutes: 0 };
      }
      days[dayKey].minutes = (days[dayKey].minutes ?? 0) + mins;
    }

    // Absences: mark days
    const userRequests = requests.filter((r) => r.userId === user.id);
    for (const req of userRequests) {
      const from = new Date(req.dateFrom);
      const to = new Date(req.dateTo);
      // Clamp to month
      const rangeFrom = from < monthStart ? monthStart : from;
      const rangeTo = to > monthEnd ? monthEnd : to;

      const d = new Date(rangeFrom);
      d.setHours(0, 0, 0, 0);
      while (d <= rangeTo) {
        const dayKey = format(d, "yyyy-MM-dd");
        // Don't overwrite presence with absence (if they worked AND have absence on same day)
        if (!days[dayKey] || days[dayKey].status !== "present") {
          days[dayKey] = {
            status: "absent",
            absenceType: canSeeUserDetails ? req.type : "ABSENT",
          };
        }
        d.setDate(d.getDate() + 1);
      }
    }

    // Strip minutes if viewer can't see details for this user
    if (!canSeeUserDetails) {
      for (const dayKey of Object.keys(days)) {
        delete days[dayKey].minutes;
      }
    }

    return {
      userId: user.id,
      name: user.name,
      department: user.dept?.name ?? user.department ?? "",
      days,
    };
  });

  return NextResponse.json({
    users: result,
    canSeeDetails,
    month: format(monthStart, "yyyy-MM"),
  });
}
