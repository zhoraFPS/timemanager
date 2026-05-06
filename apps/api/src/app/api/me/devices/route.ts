import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { audit } from "@/lib/audit";
import { revokeAllForUser } from "@/lib/refresh-tokens";
import { NextRequest, NextResponse, after } from "next/server";

/**
 * Users manage their own registered mobile devices here. Self-service
 * only — never touches other users' devices.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const devices = await db.device.findMany({
    where: { userId: user.id },
    orderBy: { lastUsed: "desc" },
    select: {
      id: true,
      deviceId: true,
      name: true,
      platform: true,
      lastIp: true,
      lastUsed: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ devices });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id erforderlich" }, { status: 400 });
  }

  // Ownership guard — can only delete your own devices.
  const device = await db.device.findUnique({ where: { id } });
  if (!device || device.userId !== user.id) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await db.device.delete({ where: { id } });

  // When the user explicitly removes a device, invalidate all active mobile
  // sessions. A stolen phone would still have a valid refresh token otherwise.
  await revokeAllForUser(user.id);

  after(() =>
    audit({
      userId: user.id,
      targetUserId: user.id,
      action: "DELETE",
      resource: "Device",
      resourceId: id,
      oldValue: { deviceId: device.deviceId, name: device.name },
    })
  );

  return NextResponse.json({ success: true });
}
