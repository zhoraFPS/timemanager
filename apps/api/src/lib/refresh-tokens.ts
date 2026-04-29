import crypto from "crypto";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { getJwtSecret } from "@/lib/mobile-auth";

const REFRESH_TTL_DAYS = 30;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueTokens(userId: string) {
  const accessToken = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .setIssuedAt()
    .sign(getJwtSecret());

  // Random opaque refresh token — value never touches the DB, only its hash.
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  await db.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(oldRefreshToken: string): Promise<
  | { userId: string; accessToken: string; refreshToken: string }
  | { error: string; status: number }
> {
  const oldHash = hashToken(oldRefreshToken);
  const record = await db.refreshToken.findUnique({
    where: { tokenHash: oldHash },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  });

  if (!record) return { error: "Unbekannter Token", status: 401 };
  if (record.revokedAt) {
    // Replay attempt — revoke all tokens for this user (defense in depth).
    await db.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { error: "Token bereits verwendet", status: 401 };
  }
  if (record.expiresAt < new Date()) {
    return { error: "Token abgelaufen", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: record.userId },
    select: { isActive: true },
  });
  if (!user?.isActive) {
    return { error: "Benutzer deaktiviert", status: 401 };
  }

  // Revoke current token and issue a fresh pair.
  const tokens = await issueTokens(record.userId);
  await db.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return { userId: record.userId, ...tokens };
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
