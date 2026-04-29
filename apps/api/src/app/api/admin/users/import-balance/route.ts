import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

interface RowInput {
  employeeNumber: string;
  balance: number;
}

/**
 * Bulk-import Gleitzeit-Salden. Used once during go-live / migration from
 * another time-tracking system: the source system's final balances are
 * uploaded as { employeeNumber, balance } pairs and land in each user's
 * `initialBalance` field.
 *
 * Every change is audited. Users not found are returned in the response so
 * the admin can fix the list and re-run.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rows = body.rows as unknown;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Keine Zeilen uebergeben" }, { status: 400 });
  }

  const parsed: RowInput[] = [];
  const errors: string[] = [];

  for (const [i, row] of (rows as unknown[]).entries()) {
    if (!row || typeof row !== "object") {
      errors.push(`Zeile ${i + 1}: ungueltiges Format`);
      continue;
    }
    const r = row as Record<string, unknown>;
    const num = typeof r.employeeNumber === "string" ? r.employeeNumber.trim() : null;
    const balance = typeof r.balance === "number" ? r.balance : Number(r.balance);
    if (!num) {
      errors.push(`Zeile ${i + 1}: Mitarbeiternummer fehlt`);
      continue;
    }
    if (!Number.isFinite(balance)) {
      errors.push(`Zeile ${i + 1} (${num}): Saldo ist keine Zahl`);
      continue;
    }
    // Sanity cap: no single user can have more than +/- 2000h carry-over.
    if (Math.abs(balance) > 2000) {
      errors.push(`Zeile ${i + 1} (${num}): Saldo ${balance}h liegt ausserhalb des Plausibilitaetsbereichs`);
      continue;
    }
    parsed.push({ employeeNumber: num, balance });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Keine gueltigen Zeilen", errors }, { status: 400 });
  }

  // Look up all users in one query
  const users = await db.user.findMany({
    where: { employeeNumber: { in: parsed.map((r) => r.employeeNumber) } },
    select: { id: true, employeeNumber: true, name: true, initialBalance: true },
  });
  const byNumber = new Map(users.map((u) => [u.employeeNumber!, u]));

  const applied: { employeeNumber: string; name: string; oldBalance: number; newBalance: number }[] = [];
  const unmatched: string[] = [];

  for (const r of parsed) {
    const user = byNumber.get(r.employeeNumber);
    if (!user) {
      unmatched.push(r.employeeNumber);
      continue;
    }
    if (user.initialBalance === r.balance) {
      // No change, skip
      continue;
    }
    await db.user.update({
      where: { id: user.id },
      data: { initialBalance: r.balance },
    });
    await audit({
      userId: session.user.id,
      targetUserId: user.id,
      action: "BALANCE_IMPORT",
      resource: "User",
      resourceId: user.id,
      oldValue: { initialBalance: user.initialBalance },
      newValue: { initialBalance: r.balance },
    });
    applied.push({
      employeeNumber: r.employeeNumber,
      name: user.name,
      oldBalance: user.initialBalance,
      newBalance: r.balance,
    });
  }

  return NextResponse.json({
    applied,
    unmatched,
    errors,
    summary: {
      processed: parsed.length,
      updated: applied.length,
      unchanged: parsed.length - applied.length - unmatched.length,
      unmatched: unmatched.length,
      invalid: errors.length,
    },
  });
}
