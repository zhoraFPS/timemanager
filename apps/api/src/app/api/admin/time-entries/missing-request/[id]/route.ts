import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { isMonthClosed } from "@/lib/month-close";
import { NextRequest, NextResponse, after } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canReview = await hasPermission(session.user.id, "time_entries", "write", "all");
  if (!canReview) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const { status } = await req.json();
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Ungueltiger Status" }, { status: 400 });
  }

  const missing = await db.missingEntryRequest.findUnique({ where: { id } });
  if (!missing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (missing.status !== "PENDING") {
    return NextResponse.json({ error: "Bereits bearbeitet" }, { status: 409 });
  }

  // Month-close catches the edge case where HR takes long to respond
  const entryDate = new Date(missing.clockIn);
  if (status === "APPROVED" && await isMonthClosed(entryDate.getFullYear(), entryDate.getMonth() + 1)) {
    return NextResponse.json(
      { error: "Monat inzwischen abgeschlossen, Antrag nicht mehr umsetzbar." },
      { status: 423 }
    );
  }

  await db.$transaction(async (tx) => {
    await tx.missingEntryRequest.update({
      where: { id },
      data: { status, reviewedBy: session.user.id, reviewedAt: new Date() },
    });

    if (status === "APPROVED") {
      const entry = await tx.timeEntry.create({
        data: {
          userId: missing.userId,
          clockIn: missing.clockIn,
          clockOut: missing.clockOut,
          type: missing.type,
          correctedBy: session.user.id,
          correctedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          targetUserId: missing.userId,
          action: "HR_CORRECTION",
          resource: "TimeEntry",
          resourceId: entry.id,
          newValue: {
            clockIn: entry.clockIn.toISOString(),
            clockOut: entry.clockOut?.toISOString() ?? null,
            type: entry.type,
            note: `Aus fehlender Eintrag-Antrag: ${missing.reason}`,
          },
        },
      });
    }
  });

  // Notify requester — response should not wait on this
  after(async () => {
    try {
      await db.notification.create({
        data: {
          userId: missing.userId,
          senderId: session.user.id,
          type: "CORRECTION",
          title:
            status === "APPROVED"
              ? "Fehlender Eintrag übernommen"
              : "Fehlender Eintrag abgelehnt",
          body: `Eintrag vom ${entryDate.toLocaleDateString("de")}`,
          link: "/dashboard/zeitansicht",
        },
      });
      await audit({
        userId: session.user.id,
        targetUserId: missing.userId,
        action: status === "APPROVED" ? "APPROVE" : "REJECT",
        resource: "MissingEntryRequest",
        resourceId: id,
        oldValue: { status: "PENDING" },
        newValue: { status, type: missing.type },
      });
    } catch {
      /* non-blocking */
    }
  });

  return NextResponse.json({ success: true });
}
