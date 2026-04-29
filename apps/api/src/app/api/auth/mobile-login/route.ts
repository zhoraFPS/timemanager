import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { TOTP, Secret } from "otpauth";
import { issueTokens } from "@/lib/refresh-tokens";
import {
  getLockoutStatus,
  recordFailedLogin,
  resetFailedLogins,
} from "@/lib/login-rate-limit";

export async function POST(req: NextRequest) {
  const { employeeNumber, password, totpCode, deviceId, deviceName } =
    await req.json();

  if (!employeeNumber || !password) {
    return NextResponse.json(
      { error: "Mitarbeiternummer und Passwort erforderlich" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { employeeNumber },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      isActive: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    return NextResponse.json({ error: "Ungueltige Anmeldedaten" }, { status: 401 });
  }

  const lockedUntil = await getLockoutStatus(user.id);
  if (lockedUntil) {
    const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000);
    return NextResponse.json(
      { error: `Konto gesperrt. Versuche es in ca. ${mins} Minuten erneut.` },
      { status: 429 }
    );
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    await recordFailedLogin(user.id);
    return NextResponse.json({ error: "Ungueltige Anmeldedaten" }, { status: 401 });
  }

  // 2FA challenge: if the user has 2FA enabled, require a valid TOTP code
  // before issuing tokens. First call returns 401 with twoFactorRequired so
  // the app can prompt for the code; second call includes totpCode.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totpCode) {
      return NextResponse.json(
        { error: "TOTP erforderlich", twoFactorRequired: true },
        { status: 401 }
      );
    }
    const totp = new TOTP({
      issuer: "VfL Zeitspiel",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(user.twoFactorSecret),
    });
    const delta = totp.validate({ token: String(totpCode), window: 1 });
    if (delta === null) {
      await recordFailedLogin(user.id);
      return NextResponse.json(
        { error: "Ungueltiger TOTP-Code", twoFactorRequired: true },
        { status: 401 }
      );
    }
  }

  await resetFailedLogins(user.id);

  // Register device if deviceId provided — only if it's unclaimed or already ours
  if (deviceId) {
    const existingDevice = await db.device.findUnique({ where: { deviceId } });
    if (existingDevice && existingDevice.userId !== user.id) {
      return NextResponse.json(
        { error: "Geraet ist bereits einem anderen Benutzer zugeordnet" },
        { status: 409 }
      );
    }
    await db.device.upsert({
      where: { deviceId },
      update: { userId: user.id, name: deviceName, lastUsed: new Date() },
      create: { userId: user.id, deviceId, name: deviceName },
    });
  }

  const tokens = await issueTokens(user.id);

  return NextResponse.json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      mustChangePassword: user.mustChangePassword,
    },
  });
}
