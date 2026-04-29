import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  const userId = await verifyMobileToken(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceId, pushToken, name } = await req.json();
  if (!deviceId) return NextResponse.json({ error: "deviceId erforderlich" }, { status: 400 });

  // Only allow update if the deviceId either doesn't exist yet, or already
  // belongs to the authenticated user. Prevents push-token hijacking by
  // pointing someone else's deviceId at the attacker's push token.
  const existing = await db.device.findUnique({ where: { deviceId } });
  if (existing && existing.userId !== userId) {
    return NextResponse.json(
      { error: "deviceId gehoert zu einem anderen Benutzer" },
      { status: 403 }
    );
  }

  const device = await db.device.upsert({
    where: { deviceId },
    update: { pushToken, name, lastUsed: new Date() },
    create: { userId, deviceId, pushToken, name },
  });

  return NextResponse.json(device);
}

export async function DELETE(req: NextRequest) {
  const userId = await verifyMobileToken(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceId } = await req.json();
  await db.device.deleteMany({ where: { userId, deviceId } });

  return NextResponse.json({ deleted: true });
}
