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

async function requireRoleWrite(userId: string) {
  return hasPermission(userId, "roles", "write");
}

/**
 * Is the caller SUPERADMIN? They bypass privilege-escalation checks since
 * by definition they already have every permission.
 */
async function isSuperAdmin(userId: string): Promise<boolean> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { name: true } } },
  });
  return userRoles.some((ur) => ur.role.name === SUPERADMIN_ROLE_NAME);
}

function normalizePermissions(
  input: unknown
): { ok: true; items: PermissionInput[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "permissions muss ein Array sein" };
  const out: PermissionInput[] = [];
  const seen = new Set<string>();
  for (const p of input) {
    if (!p || typeof p !== "object") {
      return { ok: false, error: "Ungueltiges Permission-Objekt" };
    }
    const { resource, action, scope } = p as Record<string, unknown>;
    const key = `${resource}:${action}:${scope}`;
    const parsed = parsePermissionKey(key);
    if (!parsed) {
      return { ok: false, error: `Ungueltige Permission: ${key}` };
    }
    if (!seen.has(key)) {
      seen.add(key);
      out.push(parsed);
    }
  }
  return { ok: true, items: out };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireRoleWrite(session.user.id))) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, description, permissions } = body;

  const existing = await db.role.findUnique({
    where: { id },
    include: { permissions: true },
  });
  if (!existing) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 });

  // System roles: name + description frozen.
  if (existing.isSystem && (name !== undefined || description !== undefined)) {
    return NextResponse.json(
      { error: "Name und Beschreibung von System-Rollen sind nicht editierbar" },
      { status: 400 }
    );
  }

  // Block renames that collide with other roles.
  if (name && name !== existing.name) {
    const collision = await db.role.findUnique({ where: { name } });
    if (collision && collision.id !== id) {
      return NextResponse.json({ error: "Name bereits vergeben" }, { status: 409 });
    }
  }

  // Privilege-escalation guard: unless SUPERADMIN, caller may only assign
  // permissions they themselves hold.
  let nextPermissions: PermissionInput[] | null = null;
  if (permissions !== undefined) {
    const parsed = normalizePermissions(permissions);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    nextPermissions = parsed.items;

    const isSuper = await isSuperAdmin(session.user.id);
    if (!isSuper) {
      const callerPerms = (session.user.permissions ?? []) as string[];
      for (const p of nextPermissions) {
        if (!callerCanGrant(callerPerms, p)) {
          return NextResponse.json(
            { error: `Du darfst diese Permission nicht vergeben: ${permissionKey(p)}` },
            { status: 403 }
          );
        }
      }
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    if (!existing.isSystem) {
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
    }
    if (Object.keys(data).length > 0) {
      await tx.role.update({ where: { id }, data });
    }
    if (nextPermissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (nextPermissions.length > 0) {
        await tx.rolePermission.createMany({
          data: nextPermissions.map((p) => ({ roleId: id, ...p })),
        });
      }
    }
    return tx.role.findUnique({
      where: { id },
      include: { permissions: true, _count: { select: { users: true } } },
    });
  });

  await audit({
    userId: session.user.id,
    action: "UPDATE",
    resource: "Role",
    resourceId: id,
    oldValue: {
      name: existing.name,
      description: existing.description,
      permissions: existing.permissions.map((p) => `${p.resource}:${p.action}:${p.scope}`),
    },
    newValue: {
      name: updated?.name ?? existing.name,
      description: updated?.description ?? existing.description,
      permissions: updated?.permissions.map((p) => `${p.resource}:${p.action}:${p.scope}`) ?? [],
    },
  });

  return NextResponse.json({ role: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireRoleWrite(session.user.id))) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Rolle nicht gefunden" }, { status: 404 });

  if (existing.isSystem) {
    return NextResponse.json(
      { error: "System-Rollen können nicht gelöscht werden" },
      { status: 400 }
    );
  }
  if (existing._count.users > 0) {
    return NextResponse.json(
      {
        error: `Rolle ist ${existing._count.users} Mitarbeiter(n) zugewiesen. Bitte zuerst die Zuweisungen entfernen.`,
      },
      { status: 409 }
    );
  }

  await db.role.delete({ where: { id } });

  await audit({
    userId: session.user.id,
    action: "DELETE",
    resource: "Role",
    resourceId: id,
    oldValue: { name: existing.name },
  });

  return NextResponse.json({ success: true });
}
