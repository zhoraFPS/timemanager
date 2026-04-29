import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";
import { calcNetMins } from "@/lib/working-time";

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

  // Break config
  const breakConfigs = await db.systemConfig.findMany({
    where: { key: { in: ["workday.autoBreakEnabled", "workday.autoBreakAfterHours", "workday.autoBreakMinutes"] } },
  });
  const breakCfg = Object.fromEntries(breakConfigs.map((c) => [c.key, c.value]));
  const autoBreak = breakCfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(breakCfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(breakCfg["workday.autoBreakMinutes"] ?? "30");

  let userFilter: object = {};
  if (scope === "own") {
    userFilter = { userId: session.user.id };
  } else if (scope === "team") {
    userFilter = { user: { OR: [{ id: session.user.id }, { managerId: session.user.id }] } };
  }

  const entries = await db.timeEntry.findMany({
    where: {
      clockIn: { gte: monthStart, lte: monthEnd },
      clockOut: { not: null },
      projectId: { not: null },
      ...userFilter,
    },
    select: {
      clockIn: true,
      clockOut: true,
      projectId: true,
      user: { select: { id: true, name: true, employeeNumber: true } },
      project: { select: { id: true, name: true, code: true, color: true } },
    },
    orderBy: { clockIn: "asc" },
  });

  // Aggregate by project
  const projectMap = new Map<string, {
    projectId: string;
    name: string;
    code: string;
    color: string | null;
    totalMins: number;
    entryCount: number;
    users: Map<string, { userId: string; name: string; mins: number }>;
  }>();

  for (const e of entries) {
    if (!e.project) continue;
    const pid = e.project.id;
    if (!projectMap.has(pid)) {
      projectMap.set(pid, {
        projectId: pid,
        name: e.project.name,
        code: e.project.code,
        color: e.project.color,
        totalMins: 0,
        entryCount: 0,
        users: new Map(),
      });
    }
    const p = projectMap.get(pid)!;
    const mins = calcNetMins(new Date(e.clockIn), new Date(e.clockOut!), { autoBreak, breakAfterHours, breakMinutes });
    p.totalMins += mins;
    p.entryCount++;

    const uid = e.user.id;
    if (!p.users.has(uid)) {
      p.users.set(uid, { userId: uid, name: e.user.name, mins: 0 });
    }
    p.users.get(uid)!.mins += mins;
  }

  const projects = Array.from(projectMap.values())
    .sort((a, b) => b.totalMins - a.totalMins)
    .map((p) => ({
      ...p,
      users: Array.from(p.users.values()).sort((a, b) => b.mins - a.mins),
    }));

  return NextResponse.json({ year, month, projects });
}
