import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { createNotification } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { NextRequest, NextResponse, after } from "next/server";
import type { Prisma } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canApprove = await hasPermission(session.user.id, "requests", "approve");
  if (!canApprove) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { status, comment } = body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const request = await db.request.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "Antrag nicht gefunden" }, { status: 404 });

  // Self-approval forbidden
  if (request.userId === session.user.id) {
    return NextResponse.json(
      { error: "Eigene Antraege koennen nicht selbst genehmigt werden" },
      { status: 403 }
    );
  }

  // Only PENDING requests can be approved/rejected
  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: "Antrag ist bereits bearbeitet" },
      { status: 409 }
    );
  }

  // Scope-Check: Manager/Abteilungsleiter darf eigenes Team genehmigen
  // Deputies duerfen das Team ihres Vertretenen genehmigen
  const scope = await getPermissionScope(session.user.id, "requests", "approve");
  if (scope === "team") {
    let allowed = false;

    // 1. Direct report check (managerId)
    const teamMember = await db.user.findFirst({
      where: { id: request.userId, managerId: session.user.id },
    });
    if (teamMember) allowed = true;

    // 2. Department leader check
    if (!allowed) {
      const requester = await db.user.findUnique({
        where: { id: request.userId },
        select: { managerId: true, departmentId: true },
      });
      if (requester?.departmentId) {
        const dept = await db.department.findUnique({
          where: { id: requester.departmentId },
          select: { leaderId: true },
        });
        if (dept?.leaderId === session.user.id) allowed = true;
      }

      // 3. Deputy check: Am I a deputy for the requester's manager?
      if (!allowed && requester?.managerId) {
        const manager = await db.user.findUnique({
          where: { id: requester.managerId },
          select: { deputyId: true },
        });
        if (manager?.deputyId === session.user.id) allowed = true;
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: "Keine Berechtigung fuer diesen Antrag" }, { status: 403 });
    }
  } else if (scope === "own") {
    if (request.userId !== session.user.id) {
      return NextResponse.json({ error: "Keine Berechtigung fuer diesen Antrag" }, { status: 403 });
    }
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    db.requestApproval.create({
      data: { requestId: id, approverId: session.user.id, status, comment },
    }),
    db.request.update({ where: { id }, data: { status } }),
  ];

  // If a CANCEL_VACATION is approved → also cancel the original request
  if (request.type === "CANCEL_VACATION" && status === "APPROVED" && request.relatedRequestId) {
    ops.push(
      db.request.update({
        where: { id: request.relatedRequestId },
        data: { status: "CANCELLED" },
      })
    );
  }

  await db.$transaction(ops);

  // Respond immediately — push audit + notification into the after-response
  // phase so the manager's UI updates the instant the DB transaction commits.
  const isApproved = status === "APPROVED";
  const typeLabel: Record<string, string> = {
    VACATION: "Urlaubsantrag",
    SICK: "Krankmeldung",
    HOMEOFFICE: "Homeoffice-Antrag",
    SPECIAL_LEAVE: "Sonderurlaub",
    OVERTIME: "Überstundenantrag",
    TIME_CORRECTION: "Zeitkorrektur",
    MISSING_ENTRY: "Nachtragung",
    CANCEL_VACATION: "Stornierungsantrag",
  };
  const label = typeLabel[request.type] ?? "Antrag";

  after(async () => {
    try {
      await audit({
        userId: session.user.id,
        action: isApproved ? "APPROVE" : "REJECT",
        resource: "Request",
        resourceId: id,
        oldValue: { status: request.status, type: request.type, userId: request.userId },
        newValue: { status, comment: comment ?? null },
      });
    } catch { /* never break the HTTP response */ }
    try {
      await createNotification({
        userId: request.userId,
        senderId: session.user.id,
        type: isApproved ? "REQUEST_APPROVED" : "REQUEST_REJECTED",
        title: isApproved ? `${label} genehmigt` : `${label} abgelehnt`,
        body: isApproved
          ? `Dein ${label} wurde genehmigt.${comment ? ` Kommentar: ${comment}` : ""}`
          : `Dein ${label} wurde abgelehnt.${comment ? ` Grund: ${comment}` : ""}`,
        link: `/dashboard/antraege?requestId=${id}`,
      });
    } catch { /* never break the HTTP response */ }
  });

  return NextResponse.json({ success: true });
}
