import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";

/** Counts working days (Mon–Fri) in a date range, inclusive. */
function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Returns the current user's vacation balance for the given year.
 * Supports Bearer token (mobile) and NextAuth session (web).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = parseInt(new URL(req.url).searchParams.get("year") ?? String(new Date().getFullYear()));

  // Load user with vacation config and all relevant requests
  const userData = await db.user.findUnique({
    where: { id: user.id },
    select: {
      workingTimeConfig: { select: { vacationDays: true } },
      requests: {
        where: {
          type: { in: ["VACATION", "SICK", "SPECIAL_LEAVE"] },
        },
        select: { type: true, status: true, dateFrom: true, dateTo: true },
      },
    },
  });

  const totalDays = userData?.workingTimeConfig?.vacationDays ?? 28;
  const requests = userData?.requests ?? [];

  const countDays = (reqs: typeof requests) =>
    reqs.reduce((sum, r) => sum + countWorkingDays(new Date(r.dateFrom), new Date(r.dateTo)), 0);

  const thisYearVacation = requests.filter(
    (r) => r.type === "VACATION" && new Date(r.dateFrom).getFullYear() === year
  );
  const approved = thisYearVacation.filter((r) => r.status === "APPROVED");
  const pending = thisYearVacation.filter((r) => r.status === "PENDING");

  const usedDays = countDays(approved);
  const pendingDays = countDays(pending);

  // Carryover from previous year
  const carryoverCfg = await db.systemConfig.findMany({
    where: { key: { in: ["vacation.carryoverEnabled", "vacation.carryoverMonth", "vacation.carryoverDay"] } },
  });
  const coCfg = Object.fromEntries(carryoverCfg.map((c) => [c.key, c.value]));
  const carryoverEnabled = coCfg["vacation.carryoverEnabled"] === "true";
  let carryoverDays = 0;
  if (carryoverEnabled) {
    const carryoverMonth = parseInt(coCfg["vacation.carryoverMonth"] ?? "3");
    const carryoverDay = parseInt(coCfg["vacation.carryoverDay"] ?? "31");
    const deadline = new Date(year, carryoverMonth - 1, carryoverDay);
    if (new Date() <= deadline) {
      const prevApproved = requests.filter(
        (r) => r.type === "VACATION" && r.status === "APPROVED" && new Date(r.dateFrom).getFullYear() === year - 1
      );
      const prevUsed = countDays(prevApproved);
      carryoverDays = Math.max(0, totalDays - prevUsed);
    }
  }

  const totalAvailable = totalDays + carryoverDays;
  const remainingDays = Math.max(0, totalAvailable - usedDays);

  // Sick days this year (informational)
  const sickDays = countDays(
    requests.filter(
      (r) => r.type === "SICK" && r.status === "APPROVED" && new Date(r.dateFrom).getFullYear() === year
    )
  );

  return NextResponse.json({
    year,
    totalDays,
    carryoverDays,
    totalAvailable,
    usedDays,
    pendingDays,
    remainingDays,
    sickDays,
  });
}
