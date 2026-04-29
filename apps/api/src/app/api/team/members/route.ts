import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get current user's department
  const currentUser = await db.user.findUnique({
    where: { id: user.id },
    select: { departmentId: true },
  });

  const scope = await getPermissionScope(user.id, "employees", "read");

  // Department colleagues first, then permission-based fallback
  let where: Record<string, unknown>;
  if (currentUser?.departmentId) {
    // Show department colleagues (including self)
    where = { departmentId: currentUser.departmentId, isActive: true };
  } else if (scope === "all") {
    // Admin/HR without department → all active users
    where = { isActive: true };
  } else if (scope === "team") {
    // Manager without department → direct reports + self
    where = { OR: [{ managerId: user.id }, { id: user.id }], isActive: true };
  } else {
    // No permissions, no department → just self
    where = { id: user.id, isActive: true };
  }

  const members = await db.user.findMany({
    where,
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });

  // Presence enrichment -------------------------------------------------------
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // 16h-window covers day + night shifts. Older open entries are treated as
  // stale (forgotten clock-outs) and shown as offline instead of "present".
  const presenceWindowStart = new Date(Date.now() - 16 * 60 * 60 * 1000);

  const memberIds = members.map((m) => m.id);

  // Active clock-in entries — only within presence window.
  const activeEntries = await db.timeEntry.findMany({
    where: {
      userId: { in: memberIds },
      clockOut: null,
      clockIn: { gte: presenceWindowStart, lte: todayEnd },
    },
    select: { userId: true, type: true },
  });
  const activeByUser = new Map(activeEntries.map((e) => [e.userId, e.type]));

  // Approved leave today (SICK or VACATION) — privacy: we only expose the fact
  // of absence, never the request type to the requesting user.
  const leaveToday = await db.request.findMany({
    where: {
      userId: { in: memberIds },
      status: "APPROVED",
      type: { in: ["SICK", "VACATION", "SPECIAL_LEAVE"] },
      dateFrom: { lte: todayEnd },
      dateTo: { gte: todayStart },
    },
    select: { userId: true },
  });
  const absentUserIds = new Set(leaveToday.map((r) => r.userId));

  // Build enriched response
  const enriched = members.map((m) => {
    if (activeByUser.has(m.id)) {
      return { ...m, presence: { status: "present" as const, stampType: activeByUser.get(m.id)! } };
    }
    if (absentUserIds.has(m.id)) {
      return { ...m, presence: { status: "absent" as const } };
    }
    return { ...m, presence: { status: "offline" as const } };
  });

  return NextResponse.json({ members: enriched });
}
