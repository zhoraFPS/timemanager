import { db } from "@/lib/db";
import type { Resource, Action, Scope } from "@/lib/rbac";

export type { Resource, Action, Scope };

export async function getUserPermissions(userId: string) {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: true } } },
  });

  return userRoles.flatMap((ur) => ur.role.permissions);
}

export async function hasPermission(
  userId: string,
  resource: Resource,
  action: Action,
  requiredScope?: Scope
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);

  return permissions.some((p) => {
    if (p.resource !== resource || p.action !== action) return false;
    if (!requiredScope) return true;
    if (p.scope === "all") return true;
    if (p.scope === "team" && requiredScope !== "all") return true;
    return p.scope === requiredScope;
  });
}

export async function getPermissionScope(
  userId: string,
  resource: Resource,
  action: Action
): Promise<Scope | null> {
  const permissions = await getUserPermissions(userId);

  const match = permissions
    .filter((p) => p.resource === resource && p.action === action)
    .sort((a, b) => {
      const order: Record<string, number> = { all: 0, team: 1, own: 2 };
      return (order[a.scope] ?? 3) - (order[b.scope] ?? 3);
    })[0];

  return (match?.scope as Scope) ?? null;
}
