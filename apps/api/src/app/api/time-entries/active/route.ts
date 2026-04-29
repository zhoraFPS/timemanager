import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await db.timeEntry.findFirst({
    where: { userId: user.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  });

  return NextResponse.json({ entry: active });
}
