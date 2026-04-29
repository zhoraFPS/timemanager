import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

let cachedSecret: Uint8Array | null = null;

export function getJwtSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET environment variable must be set");
  if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  cachedSecret = new TextEncoder().encode(s);
  return cachedSecret;
}

export async function verifyMobileToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}
