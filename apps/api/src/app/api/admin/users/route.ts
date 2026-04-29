import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { ensureManagerRole } from "@/lib/auto-manager-role";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canRead = await hasPermission(session.user.id, "employees", "read", "all");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const contractTypeFilter = searchParams.get("contractType") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { employeeNumber: { contains: search } },
      { dept: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (contractTypeFilter) where.contractType = contractTypeFilter;
  if (statusFilter === "active") where.isActive = true;
  if (statusFilter === "inactive") where.isActive = false;

  const users = await db.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, employeeNumber: true,
      contractType: true, isActive: true,
      dept: { select: { name: true } },
      manager: { select: { name: true } },
      roles: { include: { role: { select: { name: true } } } },
      workingTimeConfig: { select: { hoursPerWeek: true, vacationDays: true } },
    },
    orderBy: { employeeNumber: "asc" },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const {
    name, email, password, departmentId, employeeNumber, managerId, roleId,
    contractType, hoursPerDay, hoursPerWeek, vacationDays, breakMinutes,
    startDate, initialBalance, mustChangePassword,
  } = body;

  if (!name || !password || !employeeNumber) {
    return NextResponse.json({ error: "name, password und employeeNumber sind Pflichtfelder" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { employeeNumber } });
  if (existing) return NextResponse.json({ error: `Mitarbeiternummer ${employeeNumber} bereits vergeben` }, { status: 400 });

  // email is @unique NOT NULL in schema — generate placeholder if not provided
  const resolvedEmail = email?.trim() || `emp.${employeeNumber}@intern.local`;

  const emailExists = await db.user.findUnique({ where: { email: resolvedEmail } });
  if (emailExists) return NextResponse.json({ error: `E-Mail ${resolvedEmail} bereits vergeben` }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name,
      email: resolvedEmail,
      passwordHash,
      employeeNumber,
      departmentId: departmentId || null,
      managerId: managerId || null,
      contractType: contractType ?? "FULLTIME",
      startDate: startDate ? new Date(startDate) : null,
      initialBalance: initialBalance ?? 0,
      mustChangePassword: mustChangePassword ?? true,
      isActive: true,
      roles: roleId ? { create: { roleId } } : undefined,
    },
    select: { id: true, name: true, email: true, employeeNumber: true },
  });

  await db.workingTimeConfig.create({
    data: {
      userId: user.id,
      hoursPerDay: hoursPerDay ?? 8.0,
      hoursPerWeek: hoursPerWeek ?? 40.0,
      vacationDays: vacationDays ?? 28,
      breakMinutes: breakMinutes ?? 30,
    },
  });

  // If the new hire has an explicit manager, make sure that manager carries
  // the MANAGER role so they can actually approve the new hire's requests.
  if (managerId) await ensureManagerRole(managerId);

  return NextResponse.json({ user }, { status: 201 });
}
