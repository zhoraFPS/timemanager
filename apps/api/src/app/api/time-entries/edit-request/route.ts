import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { isMonthClosed } from "@/lib/month-close";
import { NextRequest, NextResponse, after } from "next/server";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { timeEntryId, newType, newClockIn, newClockOut, reason } = body;

  if (!timeEntryId || !reason?.trim()) {
    return NextResponse.json(
      { error: "timeEntryId und reason sind Pflichtfelder" },
      { status: 400 }
    );
  }

  const entry = await db.timeEntry.findFirst({
    where: { id: timeEntryId, userId: user.id },
  });
  if (!entry) return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });

  // Month-close is the hard stop — after the month is closed, no corrections.
  const entryDate = new Date(entry.clockIn);
  if (await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1)) {
    return NextResponse.json(
      { error: "Dieser Monat ist bereits abgeschlossen und kann nicht mehr korrigiert werden." },
      { status: 423 }
    );
  }

  // Optional safety cap — 0 (or missing) means unlimited, HR decides.
  const cfg = await db.systemConfig.findMany({
    where: { key: { in: ["stamp.maxCorrectionDays"] } },
  });
  const maxDays = parseInt(
    cfg.find((c) => c.key === "stamp.maxCorrectionDays")?.value ?? "0"
  );
  const ageDays = (Date.now() - entryDate.getTime()) / 86_400_000;
  if (maxDays > 0 && ageDays > maxDays) {
    return NextResponse.json(
      {
        error: `Die Korrektur liegt ${Math.floor(ageDays)} Tage zurueck. Rueckwirkende Antraege sind maximal ${maxDays} Tage moeglich.`,
      },
      { status: 400 }
    );
  }

  if (newType && !Object.keys(STAMP_IN_TYPES).includes(newType)) {
    return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
  }

  const editRequest = await db.timeEntryEditRequest.create({
    data: {
      timeEntryId,
      userId: user.id,
      newType: newType ?? null,
      newClockIn: newClockIn ? new Date(newClockIn) : null,
      newClockOut: newClockOut ? new Date(newClockOut) : null,
      reason,
    },
  });

  // Requests beyond the direct-edit grace window go to HR — not the direct
  // manager. Vertrauensarbeitszeit means the manager doesn't rule on minutes,
  // HR does the formal record correction.
  after(async () => {
    try {
      const hrAdmins = await db.user.findMany({
        where: {
          isActive: true,
          roles: { some: { role: { name: "HR_ADMIN" } } },
        },
        select: { id: true },
      });
      const requester = await db.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      });
      if (hrAdmins.length === 0) return;
      await db.notification.createMany({
        data: hrAdmins.map((hr) => ({
          userId: hr.id,
          senderId: user.id,
          type: "CORRECTION",
          title: `Zeitkorrektur-Antrag von ${requester?.name ?? "Mitarbeiter"}`,
          body: `Grund: ${reason}`,
          link: `/dashboard/mitarbeiter?tab=corrections&correctionId=${editRequest.id}`,
        })),
      });
    } catch {
      /* notifications must never break the request */
    }
  });

  return NextResponse.json({ editRequest }, { status: 201 });
}
