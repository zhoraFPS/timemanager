import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";

/** Employee withdraws their own PENDING request — no approval needed. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const request = await db.request.findUnique({ where: { id } });

  if (!request) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (request.userId !== user.id) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: "Nur offene Anträge können zurückgezogen werden" },
      { status: 400 }
    );
  }

  await db.request.update({ where: { id }, data: { status: "CANCELLED" } });

  return NextResponse.json({ success: true });
}
