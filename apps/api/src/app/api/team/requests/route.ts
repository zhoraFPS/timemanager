import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canApprove = await hasPermission(session.user.id, "requests", "approve");
  if (!canApprove) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  // Direct reports (managerId)
  const directReports = await db.user.findMany({
    where: { managerId: session.user.id },
    select: { id: true },
  });

  // Department members (if user is department leader)
  const ledDepartments = await db.department.findMany({
    where: { leaderId: session.user.id },
    select: { id: true },
  });
  const deptMembers = ledDepartments.length > 0
    ? await db.user.findMany({
        where: {
          departmentId: { in: ledDepartments.map((d) => d.id) },
          id: { not: session.user.id },
        },
        select: { id: true },
      })
    : [];

  // Deputy coverage: if I'm someone else's deputy, I see their direct reports
  const managersIDeputy = await db.user.findMany({
    where: { deputyId: session.user.id },
    select: { id: true },
  });
  const deputyReports = managersIDeputy.length > 0
    ? await db.user.findMany({
        where: { managerId: { in: managersIDeputy.map((m) => m.id) } },
        select: { id: true },
      })
    : [];

  // Merge unique IDs
  const teamIdSet = new Set([
    ...directReports.map((m) => m.id),
    ...deptMembers.map((m) => m.id),
    ...deputyReports.map((m) => m.id),
  ]);
  const teamIds = Array.from(teamIdSet);

  const requests = await db.request.findMany({
    where: {
      status: "PENDING",
      userId: { in: teamIds },
    },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ requests });
}
