import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

const MAX_TITLE = 200;
const MAX_MESSAGE = 2000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { recipientId, title, message } = body;

  if (!recipientId || !title || !message) {
    return NextResponse.json({ error: "recipientId, title und message sind Pflichtfelder" }, { status: 400 });
  }
  if (typeof title !== "string" || title.length > MAX_TITLE) {
    return NextResponse.json({ error: "Titel zu lang" }, { status: 400 });
  }
  if (typeof message !== "string" || message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "Nachricht zu lang" }, { status: 400 });
  }
  if (recipientId === session.user.id) {
    return NextResponse.json({ error: "Selbstnachrichten nicht erlaubt" }, { status: 400 });
  }

  // Sending is allowed in three cases:
  //  (1) Sender has employees:write:all (admin/HR) — can message anyone.
  //  (2) Both users belong to the same department.
  //  (3) Sender is the recipient's direct manager (direct-report relation).
  const [sender, recipient, canBroadcast] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, departmentId: true },
    }),
    db.user.findUnique({
      where: { id: recipientId },
      select: { id: true, departmentId: true, managerId: true, isActive: true },
    }),
    hasPermission(session.user.id, "employees", "write", "all"),
  ]);

  if (!recipient || !recipient.isActive) {
    return NextResponse.json({ error: "Empfaenger nicht gefunden" }, { status: 404 });
  }

  const sameDept =
    !!sender?.departmentId && sender.departmentId === recipient.departmentId;
  const isManager = recipient.managerId === session.user.id;

  if (!canBroadcast && !sameDept && !isManager) {
    return NextResponse.json(
      { error: "Du darfst nur Teammitglieder kontaktieren" },
      { status: 403 }
    );
  }

  const notification = await createNotification({
    userId: recipientId,
    senderId: session.user.id,
    type: "MESSAGE",
    title: `${sender?.name ?? "Jemand"}: ${title}`,
    body: message,
  });

  return NextResponse.json({ notification }, { status: 201 });
}
