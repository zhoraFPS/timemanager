import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { issueTokens } from "@/lib/refresh-tokens";

export async function POST(req: NextRequest) {
  const { token, deviceId, deviceName, platform, model, osVersion } = await req.json();
  if (!token || !deviceId) {
    return NextResponse.json(
      { error: "Token und deviceId erforderlich" },
      { status: 400 }
    );
  }

  const deviceToken = await db.deviceToken.findUnique({ where: { token } });
  if (!deviceToken || deviceToken.used || deviceToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Token ungueltig oder abgelaufen" },
      { status: 401 }
    );
  }

  // Mark token as used
  await db.deviceToken.update({
    where: { id: deviceToken.id },
    data: { used: true },
  });

  // Register device — only if it's unclaimed or already belongs to this user
  const existingDevice = await db.device.findUnique({ where: { deviceId } });
  if (existingDevice && existingDevice.userId !== deviceToken.userId) {
    return NextResponse.json(
      { error: "Geraet ist bereits einem anderen Benutzer zugeordnet" },
      { status: 409 }
    );
  }
  const lastIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  await db.device.upsert({
    where: { deviceId },
    update: {
      userId: deviceToken.userId, name: deviceName, lastUsed: new Date(),
      ...(lastIp && { lastIp }),
      ...(platform && { platform }),
      ...(model && { model }),
      ...(osVersion && { osVersion }),
    },
    create: { userId: deviceToken.userId, deviceId, name: deviceName, lastIp, platform, model, osVersion },
  });

  const user = await db.user.findUnique({
    where: { id: deviceToken.userId },
    select: { id: true, email: true, name: true },
  });

  const tokens = await issueTokens(deviceToken.userId);

  return NextResponse.json({ ...tokens, user });
}
