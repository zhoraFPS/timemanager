import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  userId: string;
  /** The employee the entry pertains to — who is this change *about*. */
  targetUserId?: string | null;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: unknown;
  newValue?: unknown;
};

/**
 * Central audit-log writer. Never throws — a failed audit must not break
 * the caller's operation. For compliance we still want the error in logs.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        targetUserId: input.targetUserId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        oldValue: (input.oldValue ?? null) as Prisma.InputJsonValue,
        newValue: (input.newValue ?? null) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
