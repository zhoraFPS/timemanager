import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "time_entries", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const { status } = await req.json();

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const editRequest = await db.timeEntryEditRequest.findUnique({ where: { id } });
  if (!editRequest) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await db.$transaction(async (tx) => {
    await tx.timeEntryEditRequest.update({
      where: { id },
      data: { status, reviewedBy: session.user.id, reviewedAt: new Date() },
    });

    if (status === "APPROVED") {
      const now = new Date();
      const timeEntryUpdate: {
        correctedBy: string;
        correctedAt: Date;
        type?: string;
        clockIn?: Date;
        clockOut?: Date;
      } = {
        correctedBy: session.user.id,
        correctedAt: now,
      };
      if (editRequest.newType) timeEntryUpdate.type = editRequest.newType;
      if (editRequest.newClockIn) timeEntryUpdate.clockIn = editRequest.newClockIn;
      if (editRequest.newClockOut) timeEntryUpdate.clockOut = editRequest.newClockOut;

      await tx.timeEntry.update({ where: { id: editRequest.timeEntryId }, data: timeEntryUpdate });

      // Serialize for JSON audit log (dates must be strings)
      const auditPayload: Record<string, string> = {
        correctedBy: session.user.id,
        correctedAt: now.toISOString(),
      };
      if (editRequest.newType) auditPayload.type = editRequest.newType;
      if (editRequest.newClockIn) auditPayload.clockIn = editRequest.newClockIn.toISOString();
      if (editRequest.newClockOut) auditPayload.clockOut = editRequest.newClockOut.toISOString();

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          resource: "time_entries",
          resourceId: editRequest.timeEntryId,
          newValue: auditPayload,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: editRequest.userId,
        type: "CORRECTION",
        title:
          status === "APPROVED"
            ? "Ihre Zeitkorrektur wurde genehmigt"
            : "Ihre Zeitkorrektur wurde abgelehnt",
        body: `Antrag vom ${new Date(editRequest.createdAt).toLocaleDateString("de")}`,
        link: "/dashboard/zeitansicht",
      },
    });
  });

  return NextResponse.json({ success: true });
}
