import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  callerCanGrant,
  parsePermissionKey,
  permissionKey,
  SUPERADMIN_ROLE_NAME,
  type PermissionInput,
} from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "roles", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const roles = await db.role.findMany({
    include: {
      permissions: true,
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ roles });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "roles", "write");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const { name, description, permissions } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name ist Pflichtfeld" }, { status: 400 });
  }

  const existing = await db.role.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: "Name bereits vergeben" }, { status: 409 });

  // Validate + de-duplicate permissions
  const requested: PermissionInput[] = [];
  const seen = new Set<string>();
  for (const p of (permissions ?? []) as unknown[]) {
    if (!p || typeof p !== "object") {
      return NextResponse.json({ error: "Ungueltiges Permission-Objekt" }, { status: 400 });
    }
    const { resource, action, scope } = p as Record<string, unknown>;
    const key = `${resource}:${action}:${scope}`;
    const parsed = parsePermissionKey(key);
    if (!parsed) return NextResponse.json({ error: `Ungueltige Permission: ${key}` }, { status: 400 });
    if (!seen.has(key)) {
      seen.add(key);
      requested.push(parsed);
    }
  }

  // Privilege-escalation guard: unless SUPERADMIN, caller may only grant
  // permissions they themselves hold with at least the same scope.
  const userRoles = await db.userRole.findMany({
    where: { userId: session.user.id },
    include: { role: { select: { name: true } } },
  });
  const isSuper = userRoles.some((ur) => ur.role.name === SUPERADMIN_ROLE_NAME);
  if (!isSuper) {
    const callerPerms = (session.user.permissions ?? []) as string[];
    for (const p of requested) {
      if (!callerCanGrant(callerPerms, p)) {
        return NextResponse.json(
          { error: `Du darfst diese Permission nicht vergeben: ${permissionKey(p)}` },
          { status: 403 }
        );
      }
    }
  }

  const role = await db.role.create({
    data: {
      name,
      description: description ?? null,
      isSystem: false,
      permissions: { create: requested },
    },
    include: { permissions: true, _count: { select: { users: true } } },
  });

  await audit({
    userId: session.user.id,
    action: "CREATE",
    resource: "Role",
    resourceId: role.id,
    newValue: {
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((p) => `${p.resource}:${p.action}:${p.scope}`),
    },
  });

  return NextResponse.json({ role }, { status: 201 });
}
