import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await db.shiftTemplate.findMany({ orderBy: { startTime: "asc" } });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "settings", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { name, startTime, endTime, color } = await req.json();
  if (!name || !startTime || !endTime) {
    return NextResponse.json({ error: "Name, Start und Ende erforderlich" }, { status: 400 });
  }

  const template = await db.shiftTemplate.create({
    data: { name, startTime, endTime, color: color || null },
  });
  return NextResponse.json(template, { status: 201 });
}
