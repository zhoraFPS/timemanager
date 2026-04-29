import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { createNotification } from "@/lib/notifications";
import { NextRequest, NextResponse, after } from "next/server";

const TYPE_LABELS: Record<string, string> = {
  VACATION: "Urlaubsantrag",
  SICK: "Krankmeldung",
  HOMEOFFICE: "Homeoffice-Antrag",
  SPECIAL_LEAVE: "Sonderurlaub",
  OVERTIME_REDUCE: "Überstundenabbau",
  TIME_CORRECTION: "Zeitkorrektur",
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db.request.findMany({
    where: { userId: user.id },
    include: {
      approvals: {
        include: { approver: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, dateFrom, dateTo, note, payload } = body;

  const VALID_TYPES = ["VACATION", "SICK", "HOMEOFFICE", "TIME_CORRECTION", "OVERTIME_REDUCE", "SPECIAL_LEAVE"];
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Ungültiger Antragstyp" }, { status: 400 });
  }
  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  }
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ error: "Enddatum muss nach Startdatum liegen" }, { status: 400 });
  }

  // Sanity window: at most 1 month in the past, at most 12 months in the future
  const now = new Date();
  const MONTH_MS = 31 * 24 * 60 * 60 * 1000;
  if (from.getTime() < now.getTime() - MONTH_MS) {
    return NextResponse.json(
      { error: "Antrag liegt zu weit in der Vergangenheit" },
      { status: 400 }
    );
  }
  if (from.getTime() > now.getTime() + 12 * MONTH_MS) {
    return NextResponse.json(
      { error: "Antrag liegt zu weit in der Zukunft" },
      { status: 400 }
    );
  }

  // Sick leave is a legal entitlement — not something a manager approves or
  // rejects. The moment an employee reports sick, the record is final.
  const isSickLeave = type === "SICK";
  const OVERLAP_CHECKED = ["VACATION", "SICK", "HOMEOFFICE", "SPECIAL_LEAVE"];

  // Parallelize the two read-only lookups we need before the insert: the
  // overlap check and the requester info for the eventual notification.
  const [overlap, requester] = await Promise.all([
    OVERLAP_CHECKED.includes(type)
      ? db.request.findFirst({
          where: {
            userId: user.id,
            type,
            status: { in: ["PENDING", "APPROVED"] },
            AND: [{ dateFrom: { lte: to } }, { dateTo: { gte: from } }],
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    db.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        managerId: true,
        departmentId: true,
        dept: { select: { leaderId: true } },
      },
    }),
  ]);

  if (overlap) {
    return NextResponse.json(
      { error: "Es existiert bereits ein Antrag fuer diesen Zeitraum" },
      { status: 409 }
    );
  }

  const request = await db.request.create({
    data: {
      userId: user.id,
      type,
      dateFrom: from,
      dateTo: to,
      note,
      payload,
      status: isSickLeave ? "APPROVED" : "PENDING",
    },
    include: {
      approvals: {
        include: { approver: { select: { name: true } } },
      },
    },
  });

  // Recipient lookup for the notification — same fallback as before.
  let notifyUserId: string | null = requester?.managerId ?? null;
  if (!notifyUserId && requester?.dept?.leaderId) {
    notifyUserId = requester.dept.leaderId;
  }
  if (notifyUserId === user.id) notifyUserId = null;

  // Respond immediately; do the notification write after the response. This
  // shaves the DB round-trip off the user-perceived latency of submitting.
  if (notifyUserId) {
    const recipientId = notifyUserId;
    const requesterName = requester?.name ?? "Mitarbeiter";
    after(async () => {
      const label = TYPE_LABELS[type] ?? "Antrag";
      const formatter = new Intl.DateTimeFormat("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });
      const range = `${formatter.format(from)} – ${formatter.format(to)}`;
      try {
        await createNotification({
          userId: recipientId,
          senderId: user.id,
          type: isSickLeave ? "SICK_REPORTED" : "NEW_REQUEST",
          title: isSickLeave
            ? `${requesterName} hat sich krank gemeldet`
            : `Neuer ${label} von ${requesterName}`,
          body: `Zeitraum: ${range}${note ? ` · ${note}` : ""}`,
          link: isSickLeave
            ? `/dashboard/antraege?requestId=${request.id}`
            : `/dashboard/team?tab=approvals&requestId=${request.id}`,
        });
      } catch {
        /* notifications must never break the request */
      }
    });
  }

  return NextResponse.json({ request }, { status: 201 });
}
