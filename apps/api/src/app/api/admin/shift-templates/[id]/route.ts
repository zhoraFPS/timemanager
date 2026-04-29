import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "settings", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.startTime !== undefined) data.startTime = body.startTime;
  if (body.endTime !== undefined) data.endTime = body.endTime;
  if (body.color !== undefined) data.color = body.color || null;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const template = await db.shiftTemplate.update({ where: { id }, data });
  return NextResponse.json(template);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "settings", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const count = await db.shift.count({ where: { templateId: id } });
  if (count > 0) {
    await db.shiftTemplate.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ deactivated: true });
  }
  await db.shiftTemplate.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
