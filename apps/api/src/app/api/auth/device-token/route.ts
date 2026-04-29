import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId erforderlich" }, { status: 400 });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await db.deviceToken.create({
    data: { token, userId, expiresAt },
  });

  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
}
