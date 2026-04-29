import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { isMonthClosed } from "@/lib/month-close";
import { audit } from "@/lib/audit";
import { NextRequest, NextResponse, after } from "next/server";
import { STAMP_IN_TYPES, STAMP_OUT_TYPE } from "@/lib/stamp-types";

const VALID_TYPES = [...Object.keys(STAMP_IN_TYPES), STAMP_OUT_TYPE];
const OFFLINE_BACKFILL_MAX_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type: string = body.type ?? "WORK";
  const projectId: string | null = body.projectId ?? null;
  const clientTimestamp: string | undefined = body.timestamp;

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Ungültiger Stempeltyp" }, { status: 400 });
  }

  const userId = user.id;
  const nowServer = new Date();

  // Resolve effective timestamp. Clients may submit an offline-recorded
  // timestamp when they were disconnected; accept it only if it's in the
  // past and within the 24h backfill window. Any other value falls back
  // to server time.
  let effective = nowServer;
  if (clientTimestamp) {
    const t = new Date(clientTimestamp);
    if (!isNaN(t.getTime())) {
      const delta = nowServer.getTime() - t.getTime();
      if (delta >= 0 && delta <= OFFLINE_BACKFILL_MAX_MS) {
        effective = t;
      }
    }
  }

  // Block if month is closed
  const closed = await isMonthClosed(effective.getFullYear(), effective.getMonth() + 1);
  if (closed) {
    return NextResponse.json({ error: "Monat ist abgeschlossen. Keine Aenderungen moeglich." }, { status: 423 });
  }

  // Validate project ownership / existence if provided
  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, isActive: true },
    });
    if (!project || !project.isActive) {
      return NextResponse.json({ error: "Ungültiges Projekt" }, { status: 400 });
    }
  }

  const active = await db.timeEntry.findFirst({
    where: { userId, clockOut: null },
  });

  let closedActive: { id: string; type: string; clockIn: Date; clockOut: Date } | null = null;
  if (active) {
    // Guard against setting clockOut earlier than its own clockIn (offline clock skew)
    const outTime = effective >= active.clockIn ? effective : nowServer;
    const updated = await db.timeEntry.update({
      where: { id: active.id },
      data: { clockOut: outTime },
    });
    closedActive = {
      id: active.id,
      type: active.type,
      clockIn: active.clockIn,
      clockOut: updated.clockOut ?? outTime,
    };
  }

  if (type === STAMP_OUT_TYPE) {
    if (closedActive) {
      after(() =>
        audit({
          userId,
          targetUserId: userId,
          action: "STAMP_OUT",
          resource: "TimeEntry",
          resourceId: closedActive!.id,
          newValue: {
            type: closedActive!.type,
            clockIn: closedActive!.clockIn.toISOString(),
            clockOut: closedActive!.clockOut.toISOString(),
          },
        })
      );
    }
    return NextResponse.json({ action: "clockOut" });
  }

  const entry = await db.timeEntry.create({
    data: { userId, clockIn: effective, type, projectId },
  });

  after(() =>
    audit({
      userId,
      targetUserId: userId,
      action: "STAMP_IN",
      resource: "TimeEntry",
      resourceId: entry.id,
      newValue: { type: entry.type, clockIn: entry.clockIn.toISOString(), projectId: entry.projectId },
    })
  );

  return NextResponse.json({ action: "clockIn", entry });
}
