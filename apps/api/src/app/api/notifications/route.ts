import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview") === "true";
  const rawLimit = parseInt(searchParams.get("limit") ?? "50");
  const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100));

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Only mark as read on the full nachrichten page, not on dashboard preview
  if (!preview) {
    await db.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ notifications });
}
