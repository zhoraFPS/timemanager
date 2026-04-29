import { db } from "@/lib/db";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

/**
 * Returns the lockout deadline if the user is currently locked out, or null
 * if login should proceed. Call this before any password check.
 */
export async function getLockoutStatus(userId: string): Promise<Date | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });
  if (!user?.lockedUntil) return null;
  if (user.lockedUntil.getTime() <= Date.now()) return null;
  return user.lockedUntil;
}

/**
 * Record a failed login attempt. Locks the account when MAX_FAILED_ATTEMPTS
 * is reached, for LOCKOUT_MINUTES minutes.
 */
export async function recordFailedLogin(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  });
  const next = (user?.failedLoginAttempts ?? 0) + 1;
  const shouldLock = next >= MAX_FAILED_ATTEMPTS;
  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: next,
      lockedUntil: shouldLock
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : undefined,
    },
  });
}

/** Reset on successful login. */
export async function resetFailedLogins(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
