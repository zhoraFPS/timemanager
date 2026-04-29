import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const departments = await db.department.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    });

    // Fetch leaders separately to avoid Prisma client cache issues
    const deptIds = departments.filter((d) => d.leaderId).map((d) => d.leaderId!);
    const leaders = deptIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true },
        })
      : [];
    const leaderMap = new Map(leaders.map((l) => [l.id, l]));

    const result = departments.map((d) => ({
      ...d,
      leader: d.leaderId ? leaderMap.get(d.leaderId) ?? null : null,
    }));

    return NextResponse.json({ departments: result });
  } catch (err) {
    console.error("[GET /api/admin/departments] Error:", err);
    return NextResponse.json({ error: "Interner Fehler", departments: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const { name, kostenstelleNr } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
  const department = await db.department.create({
    data: { name: name.trim(), kostenstelleNr: kostenstelleNr?.trim() || null },
  });
  return NextResponse.json({ department }, { status: 201 });
}
