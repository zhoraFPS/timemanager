import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { createNotification } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

/**
 * Employee requests cancellation of an already-APPROVED request.
 * Creates a new CANCEL_VACATION request that the manager must approve.
 * The original request stays APPROVED until the cancellation is approved.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason: string | undefined = body.reason;

  const original = await db.request.findUnique({ where: { id } });
  if (!original) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (original.userId !== user.id) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  if (original.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Nur genehmigte Anträge können storniert werden" },
      { status: 400 }
    );
  }

  // Sick leave: employee retracts directly, no manager approval needed —
  // matches the submission flow, which also doesn't require approval.
  if (original.type === "SICK") {
    await db.request.update({
      where: { id },
      data: { status: "CANCELLED", note: reason ?? original.note },
    });
    const employee = await db.user.findUnique({
      where: { id: user.id },
      select: { managerId: true },
    });
    if (employee?.managerId) {
      await createNotification({
        userId: employee.managerId,
        senderId: user.id,
        type: "SICK_REPORTED",
        title: `${user.name} hat die Krankmeldung zurückgezogen`,
        body: reason ?? "Keine Begründung angegeben",
        link: `/dashboard/antraege?requestId=${original.id}`,
      }).catch(() => {});
    }
    return NextResponse.json({ cancelled: true });
  }

  // Check: no open cancellation request for this original already
  const existing = await db.request.findFirst({
    where: { relatedRequestId: id, type: "CANCEL_VACATION", status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Es läuft bereits ein Stornierungsantrag für diesen Urlaub" },
      { status: 409 }
    );
  }

  const cancellation = await db.request.create({
    data: {
      userId: user.id,
      type: "CANCEL_VACATION",
      dateFrom: original.dateFrom,
      dateTo: original.dateTo,
      status: "PENDING",
      note: reason ?? null,
      relatedRequestId: original.id,
    },
  });

  // Notify the manager — look up managerId directly from the employee record
  const employee = await db.user.findUnique({
    where: { id: user.id },
    select: { managerId: true },
  });
  const managerId = employee?.managerId;
  if (managerId) {
    const typeLabel: Record<string, string> = {
      VACATION: "Urlaub",
      HOMEOFFICE: "Homeoffice",
      SPECIAL_LEAVE: "Sonderurlaub",
    };
    const label = typeLabel[original.type] ?? "Antrag";
    await createNotification({
      userId: managerId,
      senderId: user.id,
      type: "NEW_REQUEST",
      title: `Stornierungsantrag: ${label}`,
      body: `${user.name} möchte den genehmigten ${label} stornieren.${reason ? ` Grund: ${reason}` : ""}`,
      link: `/dashboard/antraege?requestId=${cancellation.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ cancellation });
}
