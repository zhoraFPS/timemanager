import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";

/**
 * Returns the correction policy for the calling user.
 * Used by the mobile app to decide whether to use direct edit or edit-request.
 *
 * Response:
 *   { directCorrectionDays: number, maxCorrectionDays: number }
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configs = await db.systemConfig.findMany({
    where: { key: { in: ["stamp.directCorrectionDays", "stamp.maxCorrectionDays"] } },
  });

  const get = (key: string, fallback: number) =>
    parseInt(configs.find((c) => c.key === key)?.value ?? String(fallback));

  return NextResponse.json({
    directCorrectionDays: get("stamp.directCorrectionDays", 3),
    maxCorrectionDays: get("stamp.maxCorrectionDays", 7),
  });
}
