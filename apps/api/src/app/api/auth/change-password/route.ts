import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import {
  getPasswordPolicy,
  validatePasswordShape,
  checkPasswordNotReused,
  recordPasswordChange,
} from "@/lib/password-policy";
import { audit } from "@/lib/audit";
import { NextRequest, NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { currentPassword, newPassword } = body;

  if (typeof newPassword !== "string" || !newPassword) {
    return NextResponse.json({ error: "Passwort fehlt" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });

  const policy = await getPasswordPolicy();

  // Shape check (length + complexity)
  const shape = validatePasswordShape(newPassword, policy);
  if (!shape.ok) {
    return NextResponse.json(
      { error: "Passwort erfuellt die Richtlinie nicht", violations: shape.errors },
      { status: 400 }
    );
  }

  // Verify current password unless this is a forced first-time change
  if (!user.mustChangePassword) {
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Dein Account nutzt Single-Sign-On — Passwort kann nicht ueber diese Funktion geaendert werden." },
        { status: 400 }
      );
    }
    if (!currentPassword) {
      return NextResponse.json({ error: "Aktuelles Passwort fehlt" }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Aktuelles Passwort falsch" }, { status: 400 });
    }
  }

  // Block reuse. Also block identical to current.
  if (user.passwordHash && await bcrypt.compare(newPassword, user.passwordHash)) {
    return NextResponse.json(
      { error: "Neues Passwort darf nicht dem aktuellen entsprechen" },
      { status: 400 }
    );
  }
  const reuse = await checkPasswordNotReused(user.id, newPassword, policy.historySize);
  if (reuse) {
    return NextResponse.json({ error: reuse }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });
  await recordPasswordChange(user.id, passwordHash, policy.historySize);

  after(() =>
    audit({
      userId: user.id,
      targetUserId: user.id,
      action: "UPDATE",
      resource: "User",
      resourceId: user.id,
      newValue: { passwordChanged: true },
    })
  );

  return NextResponse.json({ success: true });
}
