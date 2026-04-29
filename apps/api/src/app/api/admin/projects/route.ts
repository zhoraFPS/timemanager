import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db.project.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "settings", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const { name, code, description, color } = body;

  if (!name || !code) {
    return NextResponse.json({ error: "Name und Code erforderlich" }, { status: 400 });
  }

  const project = await db.project.create({
    data: { name, code: code.toUpperCase(), description: description || null, color: color || null },
  });

  return NextResponse.json(project, { status: 201 });
}
