import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";

/**
 * GET: Generate a new TOTP secret + QR code for setup.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, twoFactorEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: "2FA bereits aktiviert" }, { status: 400 });
  }

  const brandCfg = await db.systemConfig.findUnique({ where: { key: "branding.companyName" } });
  const issuer = brandCfg?.value ?? "VfL Zeitspiel";

  const secret = new Secret({ size: 20 });
  const totp = new TOTP({ issuer, label: user.email, algorithm: "SHA1", digits: 6, period: 30, secret });

  const otpauthUrl = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Store secret temporarily (not enabled yet until verified)
  await db.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: secret.base32 },
  });

  return NextResponse.json({
    secret: secret.base32,
    qrCode: qrDataUrl,
    otpauthUrl,
  });
}

/**
 * POST: Verify TOTP code and enable 2FA.
 * Body: { code: "123456" }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Code erforderlich" }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true, email: true },
  });
  if (!user?.twoFactorSecret) {
    return NextResponse.json({ error: "Kein 2FA-Secret vorhanden. Zuerst Setup starten." }, { status: 400 });
  }

  const brandCfg = await db.systemConfig.findUnique({ where: { key: "branding.companyName" } });
  const issuer = brandCfg?.value ?? "VfL Zeitspiel";

  const totp = new TOTP({
    issuer,
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(user.twoFactorSecret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    return NextResponse.json({ error: "Ungueltiger Code" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: true },
  });

  return NextResponse.json({ enabled: true });
}

/**
 * DELETE: Disable 2FA.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });

  return NextResponse.json({ disabled: true });
}
