import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

/**
 * Team absences for calendar view.
 * Returns approved absences (VACATION, SICK, SPECIAL_LEAVE, HOMEOFFICE) for a date range.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "requests", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const scope = await getPermissionScope(session.user.id, "requests", "read");
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) return NextResponse.json({ error: "from und to erforderlich" }, { status: 400 });

  let userFilter: object = {};
  if (scope === "own") {
    userFilter = { id: session.user.id };
  } else if (scope === "team") {
    userFilter = { OR: [{ id: session.user.id }, { managerId: session.user.id }] };
  }

  const requests = await db.request.findMany({
    where: {
      status: "APPROVED",
      type: { in: ["VACATION", "SICK", "SPECIAL_LEAVE", "HOMEOFFICE"] },
      user: { isActive: true, ...userFilter },
      OR: [
        { dateFrom: { gte: new Date(from), lte: new Date(to) } },
        { dateTo: { gte: new Date(from), lte: new Date(to) } },
        { dateFrom: { lte: new Date(from) }, dateTo: { gte: new Date(to) } },
      ],
    },
    select: {
      id: true,
      type: true,
      dateFrom: true,
      dateTo: true,
      user: { select: { id: true, name: true, dept: { select: { name: true } } } },
    },
    orderBy: { dateFrom: "asc" },
  });

  return NextResponse.json({ absences: requests });
}
