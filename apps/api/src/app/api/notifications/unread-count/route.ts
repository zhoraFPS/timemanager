import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ count: 0 });

  const count = await db.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return NextResponse.json({ count });
}
