import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { isMonthClosed } from "@/lib/month-close";
import { audit } from "@/lib/audit";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { NextRequest, NextResponse, after } from "next/server";

/**
 * Employee backfills a time entry for a day that was missed.
 *
 *   - within `stamp.directCorrectionDays`  → entry is created immediately
 *   - beyond that                          → MissingEntryRequest for HR
 *   - `stamp.maxCorrectionDays = 0`        → unlimited (month-close still applies)
 *
 * Body: { clockIn: ISO, clockOut?: ISO, type: string, reason?: string }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { clockIn, clockOut, type, reason } = body;

  if (!clockIn || !type) {
    return NextResponse.json(
      { error: "clockIn und type sind Pflichtfelder" },
      { status: 400 }
    );
  }
  if (!Object.keys(STAMP_IN_TYPES).includes(type)) {
    return NextResponse.json({ error: "Ungültiger Stempeltyp" }, { status: 400 });
  }

  const clockInDate = new Date(clockIn);
  const clockOutDate = clockOut ? new Date(clockOut) : null;

  if (isNaN(clockInDate.getTime()) || (clockOutDate && isNaN(clockOutDate.getTime()))) {
    return NextResponse.json({ error: "Ungueltiges Datum" }, { status: 400 });
  }

  const now = Date.now();
  if (clockInDate.getTime() > now || (clockOutDate && clockOutDate.getTime() > now)) {
    return NextResponse.json(
      { error: "Zeiten duerfen nicht in der Zukunft liegen." },
      { status: 400 }
    );
  }
  if (clockOutDate && clockOutDate <= clockInDate) {
    return NextResponse.json(
      { error: "Gehzeit muss nach der Kommenzeit liegen." },
      { status: 400 }
    );
  }

  // Month-close is the absolute hard stop.
  const closed = await isMonthClosed(clockInDate.getFullYear(), clockInDate.getMonth() + 1);
  if (closed) {
    return NextResponse.json(
      { error: "Dieser Monat ist bereits abgeschlossen." },
      { status: 423 }
    );
  }

  // Load policy. maxDays = 0 means "unlimited" (HR decides).
  const configs = await db.systemConfig.findMany({
    where: { key: { in: ["stamp.directCorrectionDays", "stamp.maxCorrectionDays"] } },
  });
  const get = (key: string, fallback: number) =>
    parseInt(configs.find((c) => c.key === key)?.value ?? String(fallback));

  const directDays = get("stamp.directCorrectionDays", 3);
  const maxDays = get("stamp.maxCorrectionDays", 0);
  const ageDays = (Date.now() - clockInDate.getTime()) / 86_400_000;

  if (maxDays > 0 && ageDays > maxDays) {
    return NextResponse.json(
      {
        error: `Einträge können nur bis ${maxDays} Tage rückwirkend erstellt werden.`,
        code: "WINDOW_EXPIRED",
      },
      { status: 403 }
    );
  }

  // ── Direct create (within grace) ──────────────────────────────────────────
  if (ageDays <= directDays) {
    const entry = await db.timeEntry.create({
      data: {
        userId: user.id,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        type,
      },
    });
    after(() =>
      audit({
        userId: user.id,
        targetUserId: user.id,
        action: "DIRECT_EDIT",
        resource: "TimeEntry",
        resourceId: entry.id,
        newValue: {
          clockIn: entry.clockIn.toISOString(),
          clockOut: entry.clockOut?.toISOString() ?? null,
          type: entry.type,
          note: "Nachgestempelt innerhalb der direkten Frist",
        },
      })
    );
    return NextResponse.json({ mode: "direct", entry }, { status: 201 });
  }

  // ── HR review request (beyond grace) ──────────────────────────────────────
  if (!reason?.trim()) {
    return NextResponse.json(
      { error: "Eine Begründung ist erforderlich.", code: "REASON_REQUIRED" },
      { status: 400 }
    );
  }

  const missingRequest = await db.missingEntryRequest.create({
    data: {
      userId: user.id,
      clockIn: clockInDate,
      clockOut: clockOutDate,
      type,
      reason: reason.trim(),
    },
  });

  // HR decides on formal correction requests (not the direct manager).
  after(async () => {
    try {
      const [hrAdmins, requester] = await Promise.all([
        db.user.findMany({
          where: {
            isActive: true,
            roles: { some: { role: { name: "HR_ADMIN" } } },
          },
          select: { id: true },
        }),
        db.user.findUnique({ where: { id: user.id }, select: { name: true } }),
      ]);
      if (hrAdmins.length === 0) return;
      await db.notification.createMany({
        data: hrAdmins.map((hr) => ({
          userId: hr.id,
          senderId: user.id,
          type: "CORRECTION",
          title: `Fehlender Eintrag von ${requester?.name ?? "Mitarbeiter"}`,
          body: `Grund: ${reason.trim()}`,
          link: `/dashboard/mitarbeiter?tab=corrections&missingId=${missingRequest.id}`,
        })),
      });
    } catch {
      /* notifications must never break the request */
    }
  });

  return NextResponse.json({ mode: "request", request: missingRequest }, { status: 201 });
}
