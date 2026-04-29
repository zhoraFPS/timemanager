import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfWeek, endOfWeek } from "date-fns";

/**
 * GET: Fetch shifts for a week.
 * ?week=2026-04-06 (Monday of the week)
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(user.id, "time_entries", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const scope = await getPermissionScope(user.id, "time_entries", "read");
  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get("week");
  const weekStart = weekParam
    ? startOfWeek(new Date(weekParam), { weekStartsOn: 1 })
    : startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  let userFilter: object = {};
  if (scope === "own") {
    userFilter = { userId: user.id };
  } else if (scope === "team") {
    userFilter = { user: { OR: [{ id: user.id }, { managerId: user.id }] } };
  }

  const shifts = await db.shift.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnd },
      ...userFilter,
    },
    include: {
      user: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
    },
    orderBy: [{ date: "asc" }, { template: { startTime: "asc" } }],
  });

  return NextResponse.json({ weekStart: weekStart.toISOString(), shifts });
}

/**
 * POST: Assign a shift to a user on a date.
 * Body: { userId, templateId, date, note? }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(user.id, "time_entries", "write");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { userId, templateId, date, note } = await req.json();
  if (!userId || !templateId || !date) {
    return NextResponse.json({ error: "userId, templateId und date erforderlich" }, { status: 400 });
  }

  const shift = await db.shift.upsert({
    where: { userId_date: { userId, date: new Date(date) } },
    update: { templateId, note: note || null },
    create: { userId, templateId, date: new Date(date), note: note || null },
  });

  return NextResponse.json(shift, { status: 201 });
}

/**
 * DELETE: Remove a shift assignment.
 * Body: { userId, date }
 */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(user.id, "time_entries", "write");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { userId, date } = await req.json();
  await db.shift.delete({
    where: { userId_date: { userId, date: new Date(date) } },
  }).catch(() => null);

  return NextResponse.json({ deleted: true });
}
