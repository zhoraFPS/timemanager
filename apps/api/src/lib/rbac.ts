/**
 * Single source of truth for role-based access control (RBAC).
 *
 * The lists below drive:
 *   - Prisma seed (initial system roles and their permissions)
 *   - Permission checks at runtime (src/lib/permissions.ts)
 *   - Role-edit UI (permission matrix)
 *
 * Adding a new permission means adding a resource/action/scope here and
 * teaching the relevant API route to check it. The UI picks up new rows
 * automatically.
 */

export const RESOURCES = [
  "time_entries",
  "requests",
  "employees",
  "reports",
  "roles",
  "settings",
  "audit",
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ["read", "write", "approve", "export"] as const;
export type Action = (typeof ACTIONS)[number];

export const SCOPES = ["own", "team", "all"] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * Which actions are meaningful per resource. The matrix UI hides combinations
 * that aren't applicable (e.g. "approve" only applies to requests).
 */
export const RESOURCE_ACTIONS: Record<Resource, readonly Action[]> = {
  time_entries: ["read", "write", "export"],
  requests: ["read", "write", "approve"],
  employees: ["read", "write"],
  reports: ["read", "export"],
  roles: ["read", "write"],
  settings: ["read", "write"],
  audit: ["read"],
};

export const RESOURCE_LABELS: Record<Resource, string> = {
  time_entries: "Zeiteinträge",
  requests: "Anträge",
  employees: "Mitarbeiter",
  reports: "Berichte",
  roles: "Rollen",
  settings: "Plattform-Einstellungen",
  audit: "Audit-Log",
};

export const ACTION_LABELS: Record<Action, string> = {
  read: "Lesen",
  write: "Schreiben",
  approve: "Genehmigen",
  export: "Exportieren",
};

export const SCOPE_LABELS: Record<Scope, string> = {
  own: "Eigene",
  team: "Team",
  all: "Alle",
};

/** Name of the role that carries system-admin superpowers. */
export const SUPERADMIN_ROLE_NAME = "SUPERADMIN";

/** Name of the role that managers / department leaders should hold. */
export const MANAGER_ROLE_NAME = "MANAGER";

/** Shape expected by Prisma.RolePermission create. */
export interface PermissionInput {
  resource: Resource;
  action: Action;
  scope: Scope;
}

/** Compact string form used inside session tokens and UI checks. */
export function permissionKey(p: PermissionInput): string {
  return `${p.resource}:${p.action}:${p.scope}`;
}

export function parsePermissionKey(key: string): PermissionInput | null {
  const [resource, action, scope] = key.split(":") as [Resource, Action, Scope];
  if (!RESOURCES.includes(resource)) return null;
  if (!ACTIONS.includes(action)) return null;
  if (!SCOPES.includes(scope)) return null;
  return { resource, action, scope };
}

/**
 * Ordering used to decide whether granting `wanted` requires a strictly
 * broader scope than `held`. "all" > "team" > "own".
 */
const SCOPE_RANK: Record<Scope, number> = { own: 0, team: 1, all: 2 };

export function scopeIsAtLeast(held: Scope, wanted: Scope): boolean {
  return SCOPE_RANK[held] >= SCOPE_RANK[wanted];
}

/**
 * True if a caller holding `heldPermissions` (session.user.permissions)
 * is entitled to grant `wanted`. Used to prevent privilege escalation —
 * e.g. an HR_ADMIN must not be able to create a role with `roles:write:all`
 * because they themselves don't hold that scope.
 *
 * Rule: a holder needs a permission on the same resource and action with
 * a scope at least as broad as the requested one.
 */
export function callerCanGrant(heldKeys: string[], wanted: PermissionInput): boolean {
  return heldKeys.some((k) => {
    const held = parsePermissionKey(k);
    if (!held) return false;
    if (held.resource !== wanted.resource) return false;
    if (held.action !== wanted.action) return false;
    return scopeIsAtLeast(held.scope, wanted.scope);
  });
}
