import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "time_entries", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const { userId, clockIn, clockOut, note } = body;

  if (!userId || !clockIn) {
    return NextResponse.json({ error: "userId und clockIn sind Pflichtfelder" }, { status: 400 });
  }

  const [, entry] = await db.$transaction([
    db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        resource: "time_entries",
        resourceId: userId,
        newValue: { userId, clockIn, clockOut, note },
      },
    }),
    db.timeEntry.create({
      data: {
        userId,
        clockIn: new Date(clockIn),
        clockOut: clockOut ? new Date(clockOut) : null,
        note,
        correctedBy: session.user.id,
        correctedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({ entry }, { status: 201 });
}
