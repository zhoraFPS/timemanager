import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { isMonthClosed } from "@/lib/month-close";
import { audit } from "@/lib/audit";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { NextRequest, NextResponse } from "next/server";

/**
 * HR-only direct edit of any employee's time entry. Bypasses the grace
 * window because HR is making a formal correction, not using the
 * self-service path. Every change is audited.
 *
 * Writes outside the direct-edit window for the owning employee still
 * require HR to explicitly decide.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "time_entries", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { clockIn, clockOut, type, note } = body;

  const entry = await db.timeEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });

  // Month-close is the only hard stop HR cannot bypass.
  const entryDate = new Date(entry.clockIn);
  if (await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1)) {
    return NextResponse.json(
      { error: "Monat ist bereits abgeschlossen." },
      { status: 423 }
    );
  }

  // Validate inputs
  const nextClockIn = clockIn ? new Date(clockIn) : entry.clockIn;
  const nextClockOut =
    clockOut === null ? null : clockOut ? new Date(clockOut) : entry.clockOut;

  if (isNaN(nextClockIn.getTime()) || (nextClockOut && isNaN(nextClockOut.getTime()))) {
    return NextResponse.json({ error: "Ungueltiges Datum" }, { status: 400 });
  }
  const now = Date.now();
  if (nextClockIn.getTime() > now || (nextClockOut && nextClockOut.getTime() > now)) {
    return NextResponse.json(
      { error: "Zeiten duerfen nicht in der Zukunft liegen." },
      { status: 400 }
    );
  }
  if (nextClockOut && nextClockOut <= nextClockIn) {
    return NextResponse.json(
      { error: "Gehzeit muss nach der Kommenzeit liegen." },
      { status: 400 }
    );
  }
  if (type && !Object.keys(STAMP_IN_TYPES).includes(type)) {
    return NextResponse.json({ error: "Ungueltiger Typ" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    correctedBy: session.user.id,
    correctedAt: new Date(),
  };
  if (clockIn !== undefined) updateData.clockIn = nextClockIn;
  if (clockOut !== undefined) updateData.clockOut = nextClockOut;
  if (type !== undefined) updateData.type = type;
  if (note !== undefined) updateData.note = note;

  const updated = await db.timeEntry.update({ where: { id }, data: updateData });

  await audit({
    userId: session.user.id,
    action: "HR_CORRECTION",
    resource: "TimeEntry",
    resourceId: id,
    oldValue: {
      userId: entry.userId,
      clockIn: entry.clockIn,
      clockOut: entry.clockOut,
      type: entry.type,
      note: entry.note,
    },
    newValue: {
      clockIn: updated.clockIn,
      clockOut: updated.clockOut,
      type: updated.type,
      note: updated.note,
    },
  });

  return NextResponse.json({ entry: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "time_entries", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const entry = await db.timeEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });

  const entryDate = new Date(entry.clockIn);
  if (await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1)) {
    return NextResponse.json(
      { error: "Monat ist bereits abgeschlossen." },
      { status: 423 }
    );
  }

  await db.timeEntry.delete({ where: { id } });

  await audit({
    userId: session.user.id,
    action: "HR_DELETE",
    resource: "TimeEntry",
    resourceId: id,
    oldValue: {
      userId: entry.userId,
      clockIn: entry.clockIn,
      clockOut: entry.clockOut,
      type: entry.type,
    },
  });

  return NextResponse.json({ success: true });
}
