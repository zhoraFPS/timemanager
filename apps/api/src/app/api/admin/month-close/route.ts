import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

/** GET: list all closed months */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "reports", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const closes = await db.monthClose.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  // Resolve closer names
  const userIds = [...new Set(closes.map((c) => c.closedBy))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return NextResponse.json({
    closes: closes.map((c) => ({
      ...c,
      closedByName: nameMap[c.closedBy] ?? "Unbekannt",
    })),
  });
}

/** POST: close a month (locks time entries for that month) */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canExport = await hasPermission(session.user.id, "reports", "export");
  if (!canExport) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { year, month, note } = await req.json();
  if (!year || !month) return NextResponse.json({ error: "Jahr und Monat erforderlich" }, { status: 400 });

  // Check if already closed
  const existing = await db.monthClose.findUnique({
    where: { year_month: { year, month } },
  });
  if (existing) return NextResponse.json({ error: "Monat bereits abgeschlossen" }, { status: 409 });

  const close = await db.monthClose.create({
    data: { year, month, closedBy: session.user.id, note: note ?? null },
  });

  return NextResponse.json({ close }, { status: 201 });
}

/** DELETE: reopen a month */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canExport = await hasPermission(session.user.id, "reports", "export");
  if (!canExport) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { year, month } = await req.json();
  if (!year || !month) return NextResponse.json({ error: "Jahr und Monat erforderlich" }, { status: 400 });

  await db.monthClose.deleteMany({ where: { year, month } });

  return NextResponse.json({ success: true });
}
