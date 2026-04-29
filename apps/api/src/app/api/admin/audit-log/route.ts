import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canRead = await hasPermission(session.user.id, "audit", "read", "all");
    if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
    const resource = searchParams.get("resource") ?? undefined;
    const action = searchParams.get("action") ?? undefined;
    // Per-employee view: match logs where the employee is either the actor
    // or the subject. Gives the admin what they did AND what was done to them.
    const employeeId = searchParams.get("employeeId") ?? undefined;
    // Legacy: `?userId=` behaves as a pure actor filter for backwards-compat.
    const actorId = searchParams.get("userId") ?? undefined;

    const where: Prisma.AuditLogWhereInput = {};
    if (resource) where.resource = resource;
    if (action) where.action = action;
    if (actorId) where.userId = actorId;
    if (employeeId) {
      where.OR = [{ userId: employeeId }, { targetUserId: employeeId }];
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    const userIds = [
      ...new Set(
        logs.flatMap((l) => [l.userId, l.targetUserId].filter(Boolean) as string[])
      ),
    ].filter((id) => id !== "system");

    const users = userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, employeeNumber: true },
        })
      : [];
    const nameMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      logs: logs.map((l) => ({
        ...l,
        actor: l.userId === "system"
          ? { id: "system", name: "System", employeeNumber: null }
          : nameMap.get(l.userId) ?? { id: l.userId, name: "Unbekannt", employeeNumber: null },
        target: l.targetUserId ? nameMap.get(l.targetUserId) ?? null : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[audit-log GET] failed", err);
    return NextResponse.json(
      { error: "Audit-Log konnte nicht geladen werden" },
      { status: 500 }
    );
  }
}
