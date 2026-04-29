import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      employeeNumber: true,
      twoFactorEnabled: true,
      contractType: true,
      mustChangePassword: true,
      dept: { select: { name: true } },
    },
  });

  return NextResponse.json(user);
}
