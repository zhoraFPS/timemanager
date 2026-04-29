import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { isMonthClosed } from "@/lib/month-close";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/time-entries/direct-edit
 *
 * Allows an employee to directly correct their own time entry without manager
 * approval, as long as the entry is within the `stamp.directCorrectionDays`
 * grace window configured by admins.
 *
 * Body: { timeEntryId, newType?, newClockIn?, newClockOut? }
 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { timeEntryId, newType, newClockIn, newClockOut } = body;

  if (!timeEntryId) {
    return NextResponse.json({ error: "timeEntryId ist erforderlich" }, { status: 400 });
  }

  const entry = await db.timeEntry.findFirst({
    where: { id: timeEntryId, userId: user.id },
  });
  if (!entry) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  // Check month is not closed
  const entryDate = new Date(entry.clockIn);
  const closed = await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1);
  if (closed) {
    return NextResponse.json(
      { error: "Dieser Monat ist bereits abgeschlossen." },
      { status: 423 }
    );
  }

  // Enforce direct correction window
  const config = await db.systemConfig.findUnique({
    where: { key: "stamp.directCorrectionDays" },
  });
  const directDays = parseInt(config?.value ?? "3");
  const ageDays = (Date.now() - entryDate.getTime()) / 86_400_000;

  if (ageDays > directDays) {
    return NextResponse.json(
      {
        error: `Direkte Korrekturen sind nur bis ${directDays} Tage rückwirkend möglich. Bitte stelle einen Korrekturantrag.`,
        code: "DIRECT_WINDOW_EXPIRED",
      },
      { status: 403 }
    );
  }

  // Validate new type if provided
  if (newType && !Object.keys(STAMP_IN_TYPES).includes(newType)) {
    return NextResponse.json({ error: "Ungültiger Stempeltyp" }, { status: 400 });
  }

  // Validate time ordering
  const resolvedClockIn = newClockIn ? new Date(newClockIn) : entry.clockIn;
  const resolvedClockOut = newClockOut
    ? new Date(newClockOut)
    : entry.clockOut ?? null;

  if (isNaN(resolvedClockIn.getTime()) || (resolvedClockOut && isNaN(resolvedClockOut.getTime()))) {
    return NextResponse.json({ error: "Ungueltiges Datum" }, { status: 400 });
  }

  // Future guard
  const now = Date.now();
  if (resolvedClockIn.getTime() > now || (resolvedClockOut && resolvedClockOut.getTime() > now)) {
    return NextResponse.json(
      { error: "Zeiten duerfen nicht in der Zukunft liegen." },
      { status: 400 }
    );
  }

  // The NEW times must themselves fall within the direct-correction window,
  // otherwise a user could silently back-date an entry to any past point.
  const newAgeDays =
    (Date.now() - resolvedClockIn.getTime()) / 86_400_000;
  if (newAgeDays > directDays) {
    return NextResponse.json(
      {
        error: `Neue Zeiten muessen ebenfalls innerhalb der ${directDays}-Tage-Frist liegen.`,
      },
      { status: 400 }
    );
  }

  if (resolvedClockOut && resolvedClockOut <= resolvedClockIn) {
    return NextResponse.json(
      { error: "Gehzeit muss nach der Kommenzeit liegen." },
      { status: 400 }
    );
  }

  const updated = await db.timeEntry.update({
    where: { id: timeEntryId },
    data: {
      ...(newType ? { type: newType } : {}),
      ...(newClockIn ? { clockIn: new Date(newClockIn) } : {}),
      ...(newClockOut !== undefined ? { clockOut: newClockOut ? new Date(newClockOut) : null } : {}),
    },
  });

  await audit({
    userId: user.id,
    targetUserId: user.id,
    action: "DIRECT_EDIT",
    resource: "TimeEntry",
    resourceId: timeEntryId,
    oldValue: { clockIn: entry.clockIn, clockOut: entry.clockOut, type: entry.type },
    newValue: { clockIn: updated.clockIn, clockOut: updated.clockOut, type: updated.type },
  });

  return NextResponse.json({ entry: updated });
}
