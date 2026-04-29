import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { canAccessUser } from "@/lib/team-access";
import { NextRequest, NextResponse } from "next/server";
import { startOfWeek, endOfWeek } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") ?? new Date().toISOString();
  const date = new Date(dateStr);
  const targetUserId = searchParams.get("userId") ?? user.id;

  if (targetUserId !== user.id) {
    const allowed = await canAccessUser(user.id, targetUserId, "time_entries", "read");
    if (!allowed) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const entries = await db.timeEntry.findMany({
    where: {
      userId: targetUserId,
      clockIn: {
        gte: startOfWeek(date, { weekStartsOn: 1 }),
        lte: endOfWeek(date, { weekStartsOn: 1 }),
      },
    },
    orderBy: { clockIn: "asc" },
  });

  return NextResponse.json({ entries });
}
