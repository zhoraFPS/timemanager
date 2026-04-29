import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { generateInitialPassword } from "@/lib/password";
import { ensureManagerRole } from "@/lib/auto-manager-role";
import { audit } from "@/lib/audit";
import { sendTemplateEmail } from "@/lib/email";
import { NextRequest, NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "employees", "read", "all");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, employeeNumber: true,
      department: true,
      contractType: true, isActive: true, startDate: true,
      initialBalance: true, mustChangePassword: true,
      departmentId: true, managerId: true, deputyId: true,
      workingTimeConfig: true,
      roles: { include: { role: { select: { id: true, name: true } } } },
    },
  });

  if (!user) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const {
    name, email, departmentId, managerId, deputyId, contractType,
    hoursPerDay, hoursPerWeek, vacationDays, breakMinutes,
    startDate, initialBalance, isActive, resetPassword,
    roleIds,
  } = body;

  try {
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (managerId !== undefined) updateData.managerId = managerId || null;
    if (deputyId !== undefined) updateData.deputyId = deputyId || null;
    if (contractType !== undefined) updateData.contractType = contractType;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (initialBalance !== undefined) updateData.initialBalance = parseFloat(initialBalance);
    if (isActive !== undefined) updateData.isActive = isActive;

    let generatedPassword: string | null = null;
    if (resetPassword) {
      generatedPassword = generateInitialPassword();
      updateData.passwordHash = await bcrypt.hash(generatedPassword, 12);
      updateData.mustChangePassword = true;
    }

    const before = await db.user.findUnique({
      where: { id },
      select: {
        name: true,
        email: true,
        departmentId: true,
        managerId: true,
        deputyId: true,
        contractType: true,
        isActive: true,
        startDate: true,
        initialBalance: true,
      },
    });

    await db.user.update({ where: { id }, data: updateData });

    // Whenever someone is slotted into an org-structure role that implies
    // approval authority, make sure they actually carry the MANAGER role.
    // Additive-only: never removes a role that may have been set manually.
    if (managerId) await ensureManagerRole(managerId);
    if (deputyId) await ensureManagerRole(deputyId);

    // Snapshot non-sensitive diff for audit (passwordHash intentionally omitted).
    const auditNewValue: Record<string, unknown> = {};
    for (const k of Object.keys(updateData)) {
      if (k === "passwordHash") continue;
      auditNewValue[k] = (updateData as Record<string, unknown>)[k];
    }
    if (resetPassword) auditNewValue.passwordReset = true;
    await audit({
      userId: session.user.id,
      action: "UPDATE",
      resource: "User",
      resourceId: id,
      oldValue: before,
      newValue: auditNewValue,
    });

    // Auto-set managerId to department leader if:
    // - departmentId was changed
    // - no explicit managerId was provided in this request
    // - user currently has no manager
    // - department has a leader who isn't the user themselves
    if (departmentId && managerId === undefined) {
      const updatedUser = await db.user.findUnique({
        where: { id },
        select: { managerId: true },
      });
      if (!updatedUser?.managerId) {
        const dept = await db.department.findUnique({
          where: { id: departmentId },
          select: { leaderId: true },
        });
        if (dept?.leaderId && dept.leaderId !== id) {
          await db.user.update({
            where: { id },
            data: { managerId: dept.leaderId },
          });
          await ensureManagerRole(dept.leaderId);
        }
      }
    }

    // Update role assignments
    if (Array.isArray(roleIds)) {
      await db.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        await db.userRole.createMany({
          data: roleIds.map((roleId: string) => ({ userId: id, roleId })),
        });
      }
    }

    if (hoursPerDay !== undefined || hoursPerWeek !== undefined || vacationDays !== undefined || breakMinutes !== undefined) {
      await db.workingTimeConfig.upsert({
        where: { userId: id },
        update: {
          ...(hoursPerDay !== undefined && { hoursPerDay: parseFloat(hoursPerDay) }),
          ...(hoursPerWeek !== undefined && { hoursPerWeek: parseFloat(hoursPerWeek) }),
          ...(vacationDays !== undefined && { vacationDays: parseInt(vacationDays) }),
          ...(breakMinutes !== undefined && { breakMinutes: parseInt(breakMinutes) }),
        },
        create: {
          userId: id,
          hoursPerDay: parseFloat(hoursPerDay ?? "8"),
          hoursPerWeek: parseFloat(hoursPerWeek ?? "40"),
          vacationDays: parseInt(vacationDays ?? "28"),
          breakMinutes: parseInt(breakMinutes ?? "30"),
        },
      });
    }

    // Wenn Passwort zurueckgesetzt wurde + User hat E-Mail → per Template
    // zusenden, damit Admin es nicht mehr von Hand ueberbringen muss.
    if (generatedPassword && before?.email) {
      const pw = generatedPassword;
      const recipient = before.email;
      const recipientName = before.name;
      after(async () => {
        try {
          await sendTemplateEmail(recipient, "adminPasswordReset", {
            name: recipientName,
            password: pw,
            loginUrl: process.env.NEXTAUTH_URL ?? "",
          });
        } catch {
          /* mail-failure darf den Reset nicht brechen */
        }
      });
    }

    return NextResponse.json({
      success: true,
      ...(generatedPassword ? { generatedPassword } : {}),
    });
  } catch (err) {
    console.error("[PATCH /api/admin/users/[id]] Error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
