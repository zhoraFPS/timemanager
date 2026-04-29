import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "settings", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true } });

  try {
    await sendEmail({
      to: user?.email ?? "test@firma.de",
      subject: "VfL Zeitspiel — SMTP-Test",
      text: "Dies ist eine Test-E-Mail um die SMTP-Verbindung zu pruefen.",
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "SMTP-Verbindung fehlgeschlagen" }, { status: 500 });
  }
}
