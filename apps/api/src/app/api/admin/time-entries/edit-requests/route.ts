import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextResponse } from "next/server";

/**
 * List time-entry edit requests. HR ("time_entries:write:all") reviews and
 * decides; everyone else is blocked.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canReview = await hasPermission(session.user.id, "time_entries", "write", "all");
  if (!canReview) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const requests = await db.timeEntryEditRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      timeEntry: {
        select: {
          id: true,
          clockIn: true,
          clockOut: true,
          type: true,
        },
      },
    },
  });

  // Resolve user names in one batch
  const userIds = Array.from(new Set(requests.map((r) => r.userId)));
  const users = userIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, employeeNumber: true, dept: { select: { name: true } } },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    requests: requests.map((r) => ({
      ...r,
      user: userMap.get(r.userId) ?? null,
    })),
  });
}
