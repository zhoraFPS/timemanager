import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessUser } from "@/lib/team-access";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  const allowed = await canAccessUser(session.user.id, userId, "time_entries", "read");
  if (!allowed) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const monthDate = new Date(year, month - 1, 1);

  const [timeEntries, requests] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        userId,
        clockIn: { gte: startOfMonth(monthDate), lte: endOfMonth(monthDate) },
      },
      orderBy: { clockIn: "asc" },
    }),
    db.request.findMany({
      where: {
        userId,
        status: { in: ["APPROVED", "PENDING"] },
        dateFrom: { gte: startOfYear(monthDate), lte: endOfYear(monthDate) },
      },
      orderBy: { dateFrom: "asc" },
    }),
  ]);

  return NextResponse.json({ entries: timeEntries, requests });
}
