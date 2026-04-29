import { auth } from "@/auth";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { NextRequest } from "next/server";

export interface SessionUser {
  id: string;
  name?: string;
  email?: string;
}

export async function getSessionUser(req?: NextRequest): Promise<SessionUser | null> {
  // Try mobile JWT first (Bearer token)
  if (req) {
    const userId = await verifyMobileToken(req);
    if (userId) return { id: userId };
  }

  // Fall back to NextAuth session (web)
  const session = await auth();
  if (session?.user?.id) {
    return {
      id: session.user.id,
      name: session.user.name ?? undefined,
      email: session.user.email ?? undefined,
    };
  }

  return null;
}
