import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { MANAGER_ROLE_NAME } from "@/lib/rbac";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Ensure the given user carries the MANAGER role. Called whenever a user is
 * wired into an org-structure slot that implies approval authority
 * (department leader, direct manager, deputy). Idempotent and safe — if the
 * role is already assigned, nothing happens.
 *
 * Intentionally additive-only: we never auto-remove the role, because an
 * admin may have assigned it manually for reasons unrelated to the org chart.
 * Removal is a conscious action in the Rollen page.
 */
export async function ensureManagerRole(
  userId: string,
  client: Tx = db
): Promise<void> {
  if (!userId) return;

  const role = await client.role.findUnique({
    where: { name: MANAGER_ROLE_NAME },
    select: { id: true },
  });
  if (!role) return; // MANAGER role doesn't exist in this deployment

  await client.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, roleId: role.id },
    update: {},
  });
}
