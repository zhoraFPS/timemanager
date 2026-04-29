import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessUser } from "@/lib/team-access";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const userId = searchParams.get("userId") ?? session.user.id;

  if (userId !== session.user.id) {
    const allowed = await canAccessUser(session.user.id, userId, "time_entries", "read");
    if (!allowed) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const date = new Date(year, month - 1, 1);

  const [entries, user, breakConfigs] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        userId,
        clockIn: { gte: startOfMonth(date), lte: endOfMonth(date) },
      },
      orderBy: { clockIn: "asc" },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: {
        workingTimeConfig: {
          select: { hoursPerDay: true, breakMinutes: true },
        },
        startDate: true,
      },
    }),
    db.systemConfig.findMany({
      where: { key: { in: ["workday.autoBreakEnabled", "workday.autoBreakAfterHours", "workday.autoBreakMinutes"] } },
    }),
  ]);

  const breakCfg = Object.fromEntries(breakConfigs.map((c) => [c.key, c.value]));

  return NextResponse.json({
    entries,
    workingTimeConfig: user?.workingTimeConfig ?? null,
    startDate: user?.startDate ?? null,
    breakSettings: {
      autoBreak: breakCfg["workday.autoBreakEnabled"] === "true",
      breakAfterHours: parseFloat(breakCfg["workday.autoBreakAfterHours"] ?? "6"),
      breakMinutes: parseInt(breakCfg["workday.autoBreakMinutes"] ?? "30"),
    },
  });
}
