import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await req.json();

  await db.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: { browserPushEnabled: true, pushSubscription: subscription },
    create: {
      userId: session.user.id,
      browserPushEnabled: true,
      pushSubscription: subscription,
    },
  });

  return NextResponse.json({ success: true });
}
