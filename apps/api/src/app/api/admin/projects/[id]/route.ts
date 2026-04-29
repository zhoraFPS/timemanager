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
  const { name, code, description, color, isActive } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (code !== undefined) data.code = code.toUpperCase();
  if (description !== undefined) data.description = description || null;
  if (color !== undefined) data.color = color || null;
  if (isActive !== undefined) data.isActive = isActive;

  const project = await db.project.update({ where: { id }, data });
  return NextResponse.json(project);
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

  // Check if project has time entries
  const count = await db.timeEntry.count({ where: { projectId: id } });
  if (count > 0) {
    // Deactivate instead of delete
    await db.project.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ deactivated: true });
  }

  await db.project.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
