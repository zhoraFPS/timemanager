import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  historySize: number;
  expiryDays: number;
}

export const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSymbol: true,
  historySize: 5,
  expiryDays: 90,
};

const KEYS = [
  "security.passwordMinLength",
  "security.passwordRequireUpper",
  "security.passwordRequireLower",
  "security.passwordRequireNumber",
  "security.passwordRequireSymbol",
  "security.passwordHistorySize",
  "security.passwordExpiryDays",
];

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

function parseInt10(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Load the current password policy from SystemConfig. Falls back to
 * DEFAULT_POLICY for any missing keys, so the app keeps working even on a
 * fresh install that hasn't been re-seeded.
 */
export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const rows = await db.systemConfig.findMany({ where: { key: { in: KEYS } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    minLength: parseInt10(map.get("security.passwordMinLength"), DEFAULT_POLICY.minLength),
    requireUpper: parseBool(map.get("security.passwordRequireUpper"), DEFAULT_POLICY.requireUpper),
    requireLower: parseBool(map.get("security.passwordRequireLower"), DEFAULT_POLICY.requireLower),
    requireNumber: parseBool(map.get("security.passwordRequireNumber"), DEFAULT_POLICY.requireNumber),
    requireSymbol: parseBool(map.get("security.passwordRequireSymbol"), DEFAULT_POLICY.requireSymbol),
    historySize: parseInt10(map.get("security.passwordHistorySize"), DEFAULT_POLICY.historySize),
    expiryDays: parseInt10(map.get("security.passwordExpiryDays"), DEFAULT_POLICY.expiryDays),
  };
}

/**
 * Check a plain-text password against the policy. Pure function, no DB.
 */
export function validatePasswordShape(
  pw: string,
  policy: PasswordPolicy
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (pw.length < policy.minLength) {
    errors.push(`Mindestens ${policy.minLength} Zeichen`);
  }
  if (policy.requireUpper && !/[A-ZÄÖÜ]/.test(pw)) {
    errors.push("Mindestens ein Großbuchstabe");
  }
  if (policy.requireLower && !/[a-zäöüß]/.test(pw)) {
    errors.push("Mindestens ein Kleinbuchstabe");
  }
  if (policy.requireNumber && !/[0-9]/.test(pw)) {
    errors.push("Mindestens eine Ziffer");
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9ÄÖÜäöüß]/.test(pw)) {
    errors.push("Mindestens ein Sonderzeichen");
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Check the password is not a reuse of the last N hashes the user had.
 * Returns an error string if it was reused, null otherwise.
 */
export async function checkPasswordNotReused(
  userId: string,
  newPassword: string,
  historySize: number
): Promise<string | null> {
  if (historySize <= 0) return null;
  const history = await db.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: historySize,
  });
  for (const h of history) {
    if (await bcrypt.compare(newPassword, h.passwordHash)) {
      return `Passwort wurde bereits verwendet. Bitte eines waehlen, das nicht zu den letzten ${historySize} gehoert.`;
    }
  }
  return null;
}

/**
 * After a successful password change, record the new hash and trim history
 * to `historySize`. Call this in a transaction together with the user update
 * so password + history stay in sync.
 */
export async function recordPasswordChange(
  userId: string,
  newHash: string,
  historySize: number
): Promise<void> {
  await db.passwordHistory.create({
    data: { userId, passwordHash: newHash },
  });
  if (historySize > 0) {
    // Keep only the N most-recent entries.
    const keep = await db.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: historySize,
      select: { id: true },
    });
    const keepIds = new Set(keep.map((k) => k.id));
    const stale = await db.passwordHistory.findMany({
      where: { userId, id: { notIn: [...keepIds] } },
      select: { id: true },
    });
    if (stale.length > 0) {
      await db.passwordHistory.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      });
    }
  }
}

/**
 * Returns true if the user's password is overdue for a change, based on
 * `policy.expiryDays`. Zero = no expiry.
 */
export function isPasswordExpired(
  passwordChangedAt: Date | null | undefined,
  policy: PasswordPolicy
): boolean {
  if (policy.expiryDays <= 0) return false;
  if (!passwordChangedAt) return false; // unknown age → don't force
  const ageDays = (Date.now() - passwordChangedAt.getTime()) / 86_400_000;
  return ageDays > policy.expiryDays;
}
