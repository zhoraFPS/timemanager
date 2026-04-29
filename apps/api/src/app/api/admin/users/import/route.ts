import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { generateInitialPassword } from "@/lib/password";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { CONTRACT_TYPES } from "@/lib/contract-types";

interface CsvRow {
  employeeNumber: string; firstName: string; lastName: string;
  email?: string; department?: string; contractType?: string;
  hoursPerWeek?: string; vacationDays?: string; startDate?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { rows }: { rows: CsvRow[] } = await req.json();
  if (!rows?.length) return NextResponse.json({ error: "Keine Daten" }, { status: 400 });

  const results = {
    created: 0,
    skipped: 0,
    errors: [] as string[],
    credentials: [] as { employeeNumber: string; password: string }[],
  };

  for (const row of rows) {
    if (!row.employeeNumber || !row.firstName || !row.lastName) {
      results.errors.push(`Zeile übersprungen: Pflichtfelder fehlen`);
      results.skipped++; continue;
    }
    const existing = await db.user.findUnique({ where: { employeeNumber: row.employeeNumber } });
    if (existing) {
      results.errors.push(`Nr. ${row.employeeNumber} bereits vorhanden`);
      results.skipped++; continue;
    }
    const ct = (row.contractType ?? "FULLTIME").toUpperCase();
    const template = CONTRACT_TYPES[ct as keyof typeof CONTRACT_TYPES] ?? CONTRACT_TYPES.FULLTIME;

    let departmentId: string | undefined;
    if (row.department?.trim()) {
      const dept = await db.department.upsert({
        where: { name: row.department.trim() }, update: {}, create: { name: row.department.trim() },
      });
      departmentId = dept.id;
    }

    // email is required unique in schema — generate placeholder if not provided
    const resolvedEmail = row.email?.trim() || `emp.${row.employeeNumber}@intern.local`;

    const rowPassword = generateInitialPassword();
    const rowHash = await bcrypt.hash(rowPassword, 12);

    try {
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: `${row.firstName.trim()} ${row.lastName.trim()}`,
            email: resolvedEmail,
            passwordHash: rowHash,
            employeeNumber: row.employeeNumber.trim(),
            contractType: ct,
            departmentId,
            startDate: row.startDate ? new Date(row.startDate) : null,
            mustChangePassword: true,
            isActive: true,
          },
        });
        await tx.workingTimeConfig.create({
          data: {
            userId: user.id,
            hoursPerWeek: parseFloat(row.hoursPerWeek ?? String(template.hoursPerWeek)),
            hoursPerDay: template.hoursPerDay,
            vacationDays: parseInt(row.vacationDays ?? String(template.vacationDays)),
            breakMinutes: 30,
          },
        });
      });
      results.created++;
      results.credentials.push({
        employeeNumber: row.employeeNumber.trim(),
        password: rowPassword,
      });
    } catch {
      results.errors.push(`Nr. ${row.employeeNumber}: Datensatz konnte nicht erstellt werden`);
      results.skipped++;
    }
  }
  return NextResponse.json(results, { status: 201 });
}
