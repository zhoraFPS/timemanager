import { db } from "@/lib/db";
import { getPermissionScope, type Resource, type Action } from "@/lib/permissions";

/**
 * Returns true if `callerId` is allowed to read `targetUserId`'s data for
 * the given (resource, action). Handles the three permission scopes:
 *
 *  - "all"  → always allowed
 *  - "team" → target is one of:
 *             (a) a direct report (managerId === callerId),
 *             (b) in a department the caller leads,
 *             (c) the caller is the deputy of target's manager.
 *             Caller can also always see their own data.
 *  - "own"  → only self
 *  - null   → never
 */
export async function canAccessUser(
  callerId: string,
  targetUserId: string,
  resource: Resource,
  action: Action
): Promise<boolean> {
  if (callerId === targetUserId) return true;

  const scope = await getPermissionScope(callerId, resource, action);
  if (!scope) return false;
  if (scope === "all") return true;
  if (scope === "own") return false;

  // scope === "team": look up the target's manager and department
  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { managerId: true, departmentId: true },
  });
  if (!target) return false;

  // (a) direct report
  if (target.managerId === callerId) return true;

  // (b) department leader
  if (target.departmentId) {
    const dept = await db.department.findUnique({
      where: { id: target.departmentId },
      select: { leaderId: true },
    });
    if (dept?.leaderId === callerId) return true;
  }

  // (c) deputy of target's manager
  if (target.managerId) {
    const manager = await db.user.findUnique({
      where: { id: target.managerId },
      select: { deputyId: true },
    });
    if (manager?.deputyId === callerId) return true;
  }

  return false;
}
