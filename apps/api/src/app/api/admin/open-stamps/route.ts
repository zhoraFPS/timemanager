import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

/**
 * Lists open clock-ins older than `thresholdHours` (default 2h). Used by the
 * HR "Offene Stempel" widget to spot forgotten clock-outs before the nightly
 * auto-clockout runs (or when the cron isn't wired up yet).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "time_entries", "read", "all");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const url = new URL(req.url);
  const thresholdHours = Math.max(
    0.25,
    parseFloat(url.searchParams.get("hours") ?? "2"),
  );
  const cutoff = new Date(Date.now() - thresholdHours * 3_600_000);

  const entries = await db.timeEntry.findMany({
    where: {
      clockOut: null,
      clockIn: { lt: cutoff },
    },
    select: {
      id: true,
      clockIn: true,
      type: true,
      user: {
        select: {
          id: true,
          name: true,
          employeeNumber: true,
          dept: { select: { name: true } },
        },
      },
    },
    orderBy: { clockIn: "asc" }, // oldest first — most urgent
  });

  return NextResponse.json({
    thresholdHours,
    entries: entries.map((e) => ({
      id: e.id,
      clockIn: e.clockIn.toISOString(),
      type: e.type,
      ageHours: +((Date.now() - e.clockIn.getTime()) / 3_600_000).toFixed(1),
      user: {
        id: e.user.id,
        name: e.user.name,
        employeeNumber: e.user.employeeNumber,
        department: e.user.dept?.name ?? null,
      },
    })),
  });
}
