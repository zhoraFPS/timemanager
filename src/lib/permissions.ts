import type { Session } from "next-auth";
import type { Resource, Action, Scope } from "@/lib/rbac";

export type { Resource, Action, Scope };

export function checkPermission(
  session: Session,
  resource: Resource,
  action: Action,
  requiredScope?: Scope
): boolean {
  const perms = session.user.permissions ?? [];
  return perms.some((p) => {
    const [r, a, s] = p.split(":") as [Resource, Action, Scope];
    if (r !== resource || a !== action) return false;
    if (!requiredScope) return true;
    if (s === "all") return true;
    if (s === "team" && requiredScope !== "all") return true;
    return s === requiredScope;
  });
}
