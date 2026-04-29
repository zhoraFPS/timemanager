import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { ensureManagerRole } from "@/lib/auto-manager-role";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const { id } = await params;
  const count = await db.user.count({ where: { departmentId: id, isActive: true } });
  if (count > 0) return NextResponse.json({ error: `${count} aktive Mitarbeiter in dieser Abteilung` }, { status: 400 });
  await db.department.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; kostenstelleNr?: string | null; leaderId?: string | null } = {};
  if (body.name !== undefined) {
    if (!body.name?.trim()) return NextResponse.json({ error: "Name fehlt" }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.kostenstelleNr !== undefined) {
    data.kostenstelleNr = body.kostenstelleNr?.trim() || null;
  }
  if (body.leaderId !== undefined) {
    data.leaderId = body.leaderId || null;
  }
  const department = await db.$transaction(async (tx) => {
    const updated = await tx.department.update({ where: { id }, data });
    if (data.leaderId) {
      await ensureManagerRole(data.leaderId, tx);
    }
    return updated;
  });
  return NextResponse.json({ department });
}
