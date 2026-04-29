import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lastUser = await db.user.findFirst({
    where: { employeeNumber: { not: null } },
    orderBy: { employeeNumber: "desc" },
    select: { employeeNumber: true },
  });
  const last = parseInt(lastUser?.employeeNumber ?? "999");
  return NextResponse.json({ next: String(last + 1) });
}
