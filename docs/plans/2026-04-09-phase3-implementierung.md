# Phase 3 — Mitarbeiterverwaltung Implementierungsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Vollständige Mitarbeiterverwaltung — Anlegen, Suchen, Bearbeiten, CSV-Import, Login per Nummer, Passwort-Änderung, Abteilungsverwaltung

**Architecture:** Erweiterung des bestehenden Next.js 16 / Prisma 7 Systems. Neue DB-Modelle, Auth.js Credentials-Provider auf employeeNumber umstellen, neue API-Routes und shadcn/ui Wizard-Komponenten.

**Tech Stack:** Next.js 16, Prisma 7, Auth.js v5, shadcn/ui, papaparse (CSV), bcryptjs

---

## Kontext für alle Tasks

- Arbeitsverzeichnis: `C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager`
- Prisma 7 mit PrismaPg Adapter in `src/lib/db.ts`
- Auth.js v5 in `src/auth.ts` — aktuell Login per E-Mail
- shadcn/ui base-nova/base-ui Style
- `hasPermission` aus `src/lib/permissions.ts`

---

## Task 1: DB-Migration Phase 3

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev --name phase3`

**Step 1: Schema erweitern**

Im `User` Modell folgende Felder hinzufügen (nach `isActive`):
```prisma
  employeeNumber     String?  @unique
  startDate          DateTime?
  mustChangePassword Boolean  @default(true)
  contractType       String   @default("FULLTIME")
  initialBalance     Float    @default(0)
  departmentId       String?
  department         Department? @relation(fields: [departmentId], references: [id])
  workingTimeConfig  WorkingTimeConfig?
```

Das bestehende `department String?` Feld umbenennen zu `departmentLegacy String?` (damit alte Daten nicht verloren gehen) ODER einfach behalten und `departmentId` ergänzen — **beides hinzufügen**, `department String?` bleibt als `departmentName String?` erhalten für Abwärtskompatibilität.

**Wichtig:** Füge `departmentName String?` hinzu (Umbenennung von `department`) und `departmentId String?` (FK). Da `department` bereits existiert — es als zusätzliches `departmentId` + `departmentName` hinzufügen, das bestehende `department` Feld NICHT entfernen (Migration würde fehlschlagen).

Tatsächlich: Lese das Schema ZUERST und schaue welche Felder bereits vorhanden sind. Füge nur fehlende hinzu.

**Neue Modelle am Ende des Schemas hinzufügen:**

```prisma
model WorkingTimeConfig {
  id            String   @id @default(cuid())
  userId        String   @unique
  hoursPerDay   Float    @default(8.0)
  hoursPerWeek  Float    @default(40.0)
  vacationDays  Int      @default(28)
  breakMinutes  Int      @default(30)
  effectiveFrom DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Department {
  id    String  @id @default(cuid())
  name  String  @unique
  users User[]
}
```

Im `User` Modell Relations ergänzen:
```prisma
  workingTimeConfig WorkingTimeConfig?
  dept              Department?        @relation(fields: [departmentId], references: [id])
```

**Step 2: Migration ausführen**
```bash
npx prisma migrate dev --name phase3
```

**Step 3: Seed — Admin User mustChangePassword auf false setzen + employeeNumber**
```bash
npx prisma studio
```
Oder direkt per Script — füge in `prisma/seed.ts` nach dem Admin-User-Upsert hinzu:
```ts
  await db.user.update({
    where: { email: "admin@firma.de" },
    data: {
      mustChangePassword: false,
      employeeNumber: "1000",
      contractType: "FULLTIME",
    },
  });

  // Standard-Abteilungen anlegen
  const departments = ["Büro", "Stadion", "Technik", "Marketing", "Geschäftsführung"];
  for (const name of departments) {
    await db.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // WorkingTimeConfig für Admin
  await db.workingTimeConfig.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      hoursPerDay: 8.0,
      hoursPerWeek: 40.0,
      vacationDays: 28,
      breakMinutes: 30,
    },
  });
```

```bash
npx prisma db seed
```

**Step 4: Build prüfen + Commit**
```bash
npm run build
git add -A
git commit -m "feat: add Phase 3 DB models — WorkingTimeConfig, Department, User extensions"
```

---

## Task 2: Login per Mitarbeiternummer + mustChangePassword Flow

**Files:**
- Modify: `src/auth.ts`
- Modify: `src/middleware.ts`
- Create: `src/app/dashboard/passwort-aendern/page.tsx`
- Create: `src/app/api/auth/change-password/route.ts`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/types/next-auth.d.ts`

**Step 1: `src/auth.ts` — Login per Mitarbeiternummer**

Ersetze den `authorize` Callback:
```ts
async authorize(credentials) {
  if (!credentials?.employeeNumber || !credentials?.password) return null;

  const user = await db.user.findUnique({
    where: { employeeNumber: credentials.employeeNumber as string },
  });

  if (!user || !user.isActive) return null;

  const isValid = await bcrypt.compare(
    credentials.password as string,
    user.passwordHash
  );
  if (!isValid) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name,
    mustChangePassword: user.mustChangePassword,
  };
},
```

Credentials-Felder anpassen:
```ts
credentials: {
  employeeNumber: { label: "Mitarbeiternummer", type: "text" },
  password: { label: "Passwort", type: "password" },
},
```

JWT Callback — `mustChangePassword` speichern:
```ts
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
  }
  return token;
},
```

Session Callback — `mustChangePassword` weiterleiten:
```ts
async session({ session, token }) {
  if (token.id) session.user.id = token.id as string;
  session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false;
  return session;
},
```

**Step 2: `src/types/next-auth.d.ts` erweitern**
```ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      mustChangePassword: boolean;
    };
  }
}
```

**Step 3: `src/middleware.ts` — mustChangePassword Redirect**

Die Middleware prüft nur JWT — sie hat keinen DB-Zugriff. Nutze stattdessen einen Check im Dashboard-Layout.

In `src/app/dashboard/layout.tsx` nach dem Session-Check hinzufügen:
```ts
if (session.user.mustChangePassword) {
  redirect("/dashboard/passwort-aendern");
}
```

**Step 4: `src/app/api/auth/change-password/route.ts`**
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });

  // Bei mustChangePassword: kein currentPassword nötig
  if (!user.mustChangePassword) {
    if (!currentPassword) return NextResponse.json({ error: "Aktuelles Passwort fehlt" }, { status: 400 });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Aktuelles Passwort falsch" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return NextResponse.json({ success: true });
}
```

**Step 5: `src/app/dashboard/passwort-aendern/page.tsx`**
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswortAendernPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Passwörter stimmen nicht überein");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mindestens 8 Zeichen erforderlich");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Fehler");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
          <CardDescription>
            Bitte lege bei deinem ersten Login ein neues Passwort fest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Neues Passwort</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Passwort bestätigen</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird gespeichert..." : "Passwort setzen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 6: Login-Formular anpassen**

In `src/components/auth/login-form.tsx`:
- `type="email"` → `type="text"` für das erste Feld
- Label und name ändern: `email` → `employeeNumber`
- Placeholder: `"Mitarbeiternummer"`
- `signIn` Call: `employeeNumber: form.get("employeeNumber")`

**Step 7: Build + Commit**
```bash
npm run build
git add -A
git commit -m "feat: switch login to employee number and add mustChangePassword flow"
```

---

## Task 3: Abteilungsverwaltung

**Files:**
- Create: `src/app/api/admin/departments/route.ts`
- Create: `src/app/api/admin/departments/[id]/route.ts`
- Create: `src/components/admin/department-manager.tsx`
- Modify: `src/app/dashboard/einstellungen/page.tsx`

**Step 1: `src/app/api/admin/departments/route.ts`**
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const departments = await db.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ departments });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name fehlt" }, { status: 400 });

  const department = await db.department.create({ data: { name: name.trim() } });
  return NextResponse.json({ department }, { status: 201 });
}
```

**Step 2: `src/app/api/admin/departments/[id]/route.ts`**
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;

  const count = await db.user.count({ where: { departmentId: id, isActive: true } });
  if (count > 0) {
    return NextResponse.json({ error: `${count} aktive Mitarbeiter in dieser Abteilung` }, { status: 400 });
  }

  await db.department.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name fehlt" }, { status: 400 });

  const department = await db.department.update({ where: { id }, data: { name: name.trim() } });
  return NextResponse.json({ department });
}
```

**Step 3: `src/components/admin/department-manager.tsx`**
```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";

interface Department {
  id: string;
  name: string;
  _count: { users: number };
}

export function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDepartments() {
    const res = await fetch("/api/admin/departments");
    const data = await res.json();
    setDepartments(data.departments ?? []);
  }

  useEffect(() => { fetchDepartments(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      await fetchDepartments();
    } else {
      const data = await res.json();
      setError(data.error ?? "Fehler");
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/departments/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchDepartments();
    } else {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Löschen");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abteilungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Neue Abteilung..."
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={loading}>
            <Plus className="h-4 w-4 mr-1" /> Hinzufügen
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          {departments.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-2 border border-border rounded-md">
              <div className="flex items-center gap-2">
                <span className="text-sm">{d.name}</span>
                <Badge variant="secondary" className="text-xs">{d._count.users} MA</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(d.id)}
                disabled={d._count.users > 0}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 4: `src/app/dashboard/einstellungen/page.tsx` erweitern**
```tsx
import { DepartmentManager } from "@/components/admin/department-manager";

export default function EinstellungenPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <DepartmentManager />
    </div>
  );
}
```

**Step 5: Build + Commit**
```bash
npm run build
git add -A
git commit -m "feat: add department management with CRUD API and settings UI"
```

---

## Task 4: Mitarbeiter-Anlege-Wizard

**Files:**
- Create: `src/lib/contract-types.ts`
- Create: `src/app/api/admin/users/next-employee-number/route.ts`
- Create: `src/components/admin/create-employee-wizard.tsx`
- Modify: `src/app/dashboard/mitarbeiter/page.tsx`

**Step 1: `src/lib/contract-types.ts`**
```ts
export const CONTRACT_TYPES = {
  FULLTIME:  { label: "Vollzeit",   hoursPerDay: 8.0,  hoursPerWeek: 40.0, vacationDays: 28 },
  PARTTIME:  { label: "Teilzeit",   hoursPerDay: 4.0,  hoursPerWeek: 20.0, vacationDays: 14 },
  MINIJOB:   { label: "Minijob",    hoursPerDay: 2.0,  hoursPerWeek: 10.0, vacationDays: 10 },
  INTERN:    { label: "Praktikant", hoursPerDay: 8.0,  hoursPerWeek: 40.0, vacationDays: 10 },
  FREELANCE: { label: "Freelancer", hoursPerDay: 8.0,  hoursPerWeek: 40.0, vacationDays: 0  },
} as const;

export type ContractType = keyof typeof CONTRACT_TYPES;
```

**Step 2: `src/app/api/admin/users/next-employee-number/route.ts`**
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lastUser = await db.user.findFirst({
    where: { employeeNumber: { not: null } },
    orderBy: { employeeNumber: "desc" },
    select: { employeeNumber: true },
  });

  const last = parseInt(lastUser?.employeeNumber ?? "999");
  const next = String(last + 1);
  return NextResponse.json({ next });
}
```

**Step 3: `src/app/api/admin/users/route.ts` erweitern**

Ersetze die POST-Methode komplett:
```ts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const {
    name, email, password, departmentId, employeeNumber,
    managerId, roleId, contractType, hoursPerDay, hoursPerWeek,
    vacationDays, breakMinutes, startDate, initialBalance, mustChangePassword,
  } = body;

  if (!name || !password || !employeeNumber) {
    return NextResponse.json({ error: "name, password und employeeNumber sind Pflichtfelder" }, { status: 400 });
  }

  // Nummer bereits vergeben?
  const existing = await db.user.findUnique({ where: { employeeNumber } });
  if (existing) return NextResponse.json({ error: `Mitarbeiternummer ${employeeNumber} bereits vergeben` }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name,
      email: email || null,
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

  // WorkingTimeConfig anlegen
  await db.workingTimeConfig.create({
    data: {
      userId: user.id,
      hoursPerDay: hoursPerDay ?? 8.0,
      hoursPerWeek: hoursPerWeek ?? 40.0,
      vacationDays: vacationDays ?? 28,
      breakMinutes: breakMinutes ?? 30,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
```

**Step 4: `src/components/admin/create-employee-wizard.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_TYPES, type ContractType } from "@/lib/contract-types";
import { CheckCircle2 } from "lucide-react";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 1 | 2 | 3;

const DEFAULT_PASSWORD = "Start2026!";

export function CreateEmployeeWizard({ onSuccess, onCancel }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [createdEmployee, setCreatedEmployee] = useState<{ name: string; employeeNumber: string } | null>(null);

  // Departments + Managers
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);

  // Schritt 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [startDate, setStartDate] = useState("");

  // Schritt 2
  const [contractType, setContractType] = useState<ContractType>("FULLTIME");
  const [hoursPerWeek, setHoursPerWeek] = useState("40");
  const [hoursPerDay, setHoursPerDay] = useState("8");
  const [vacationDays, setVacationDays] = useState("28");
  const [breakMinutes, setBreakMinutes] = useState("30");
  const [initialBalance, setInitialBalance] = useState("0");

  // Schritt 3
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [roleId, setRoleId] = useState("");

  useEffect(() => {
    // Nächste freie Mitarbeiternummer laden
    fetch("/api/admin/users/next-employee-number")
      .then((r) => r.json())
      .then((d) => setEmployeeNumber(d.next ?? "1001"));

    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments ?? []));

    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setManagers(d.users ?? []));

    fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((d) => setRoles(d.roles ?? []));
  }, []);

  function applyContractTemplate(type: ContractType) {
    setContractType(type);
    const t = CONTRACT_TYPES[type];
    setHoursPerWeek(String(t.hoursPerWeek));
    setHoursPerDay(String(t.hoursPerDay));
    setVacationDays(String(t.vacationDays));
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim() || undefined,
        password,
        employeeNumber: employeeNumber.trim(),
        departmentId: departmentId || undefined,
        managerId: managerId || undefined,
        contractType,
        hoursPerDay: parseFloat(hoursPerDay),
        hoursPerWeek: parseFloat(hoursPerWeek),
        vacationDays: parseInt(vacationDays),
        breakMinutes: parseInt(breakMinutes),
        startDate: startDate || undefined,
        initialBalance: parseFloat(initialBalance),
        mustChangePassword,
        roleId: roleId || undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setCreatedEmployee({ name: data.user.name, employeeNumber: data.user.employeeNumber });
      setDone(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Anlegen");
    }
    setLoading(false);
  }

  if (done && createdEmployee) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
          <div>
            <p className="text-lg font-semibold">{createdEmployee.name} wurde angelegt</p>
            <p className="text-muted-foreground text-sm mt-1">
              Mitarbeiternummer: <span className="font-mono font-bold">{createdEmployee.employeeNumber}</span>
            </p>
            <p className="text-muted-foreground text-sm">
              Passwort: <span className="font-mono">{password}</span>
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={onCancel}>Schließen</Button>
            <Button onClick={() => { setDone(false); setStep(1); setFirstName(""); setLastName(""); setEmail(""); onSuccess(); }}>
              Weiteren Mitarbeiter anlegen
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Mitarbeiter anlegen</CardTitle>
          <div className="flex gap-1">
            {([1, 2, 3] as Step[]).map((s) => (
              <div
                key={s}
                className={`w-8 h-1.5 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Schritt 1: Stammdaten */}
        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground font-medium">Schritt 1: Stammdaten</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Vorname *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Nachname *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mitarbeiternummer *</Label>
                <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-Mail (optional)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Abteilung</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vorgesetzter</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Eintrittsdatum *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={!firstName.trim() || !lastName.trim() || !employeeNumber.trim()}
            >
              Weiter →
            </Button>
          </>
        )}

        {/* Schritt 2: Arbeitszeit */}
        {step === 2 && (
          <>
            <p className="text-sm text-muted-foreground font-medium">Schritt 2: Arbeitszeit & Urlaub</p>
            <div className="space-y-2">
              <Label>Vertragsart</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(CONTRACT_TYPES) as [ContractType, (typeof CONTRACT_TYPES)[ContractType]][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => applyContractTemplate(key)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      contractType === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Stunden/Woche</Label>
                <Input type="number" step="0.5" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Stunden/Tag</Label>
                <Input type="number" step="0.5" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Urlaubstage/Jahr</Label>
                <Input type="number" value={vacationDays} onChange={(e) => setVacationDays(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Pause (Minuten/Tag)</Label>
                <Input type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Anfangssaldo (Stunden, + oder -)</Label>
              <Input
                type="number"
                step="0.25"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">← Zurück</Button>
              <Button onClick={() => setStep(3)} className="flex-1">Weiter →</Button>
            </div>
          </>
        )}

        {/* Schritt 3: Zugang */}
        {step === 3 && (
          <>
            <p className="text-sm text-muted-foreground font-medium">Schritt 3: Zugangsdaten</p>
            <div className="space-y-2">
              <Label>Standardpasswort</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mustChange"
                checked={mustChangePassword}
                onChange={(e) => setMustChangePassword(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="mustChange">Passwortänderung beim ersten Login erzwingen</Label>
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">← Zurück</Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? "Wird angelegt..." : "Mitarbeiter anlegen"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 5: Build + Commit**
```bash
npm run build
git add -A
git commit -m "feat: add employee creation wizard with contract types and working time config"
```

---

## Task 5: Mitarbeiter-Suche + Tabelle + Bearbeitung

**Files:**
- Modify: `src/app/api/admin/users/route.ts` (GET erweitern mit Suche)
- Create: `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/components/admin/user-table.tsx`
- Modify: `src/app/dashboard/mitarbeiter/page.tsx`

**Step 1: GET API mit Suchparameter erweitern**

In `src/app/api/admin/users/route.ts` GET-Handler erweitern:
```ts
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "employees", "read", "all");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const contractType = searchParams.get("contractType") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { employeeNumber: { contains: search } },
      { dept: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (contractType) where.contractType = contractType;
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
```

**Step 2: `src/app/api/admin/users/[id]/route.ts`**
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "employees", "read", "all");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, employeeNumber: true,
      contractType: true, isActive: true, startDate: true,
      initialBalance: true, mustChangePassword: true,
      departmentId: true, managerId: true,
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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const {
    name, email, departmentId, managerId, contractType,
    hoursPerDay, hoursPerWeek, vacationDays, breakMinutes,
    startDate, initialBalance, isActive, resetPassword,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email || null;
  if (departmentId !== undefined) updateData.departmentId = departmentId || null;
  if (managerId !== undefined) updateData.managerId = managerId || null;
  if (contractType !== undefined) updateData.contractType = contractType;
  if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
  if (initialBalance !== undefined) updateData.initialBalance = initialBalance;
  if (isActive !== undefined) updateData.isActive = isActive;

  if (resetPassword) {
    const passwordHash = await bcrypt.hash("Start2026!", 12);
    updateData.passwordHash = passwordHash;
    updateData.mustChangePassword = true;
  }

  await db.user.update({ where: { id }, data: updateData });

  if (hoursPerDay !== undefined || hoursPerWeek !== undefined || vacationDays !== undefined) {
    await db.workingTimeConfig.upsert({
      where: { userId: id },
      update: {
        ...(hoursPerDay !== undefined && { hoursPerDay }),
        ...(hoursPerWeek !== undefined && { hoursPerWeek }),
        ...(vacationDays !== undefined && { vacationDays }),
        ...(breakMinutes !== undefined && { breakMinutes }),
      },
      create: {
        userId: id,
        hoursPerDay: hoursPerDay ?? 8,
        hoursPerWeek: hoursPerWeek ?? 40,
        vacationDays: vacationDays ?? 28,
        breakMinutes: breakMinutes ?? 30,
      },
    });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: `src/components/admin/user-table.tsx` komplett ersetzen**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserPlus } from "lucide-react";
import { CONTRACT_TYPES } from "@/lib/contract-types";
import { CreateEmployeeWizard } from "@/components/admin/create-employee-wizard";

interface User {
  id: string;
  name: string;
  email: string | null;
  employeeNumber: string | null;
  contractType: string;
  isActive: boolean;
  dept: { name: string } | null;
  manager: { name: string } | null;
  roles: { role: { name: string } }[];
  workingTimeConfig: { hoursPerWeek: number; vacationDays: number } | null;
}

export function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showWizard, setShowWizard] = useState(false);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (contractFilter) params.set("contractType", contractFilter);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [search, contractFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  if (showWizard) {
    return (
      <CreateEmployeeWizard
        onSuccess={fetchUsers}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter-Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, Nummer oder Abteilung..."
            className="pl-9"
          />
        </div>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Vertragsart" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Alle</SelectItem>
            {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Alle</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="inactive">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowWizard(true)} size="sm">
          <UserPlus className="h-4 w-4 mr-2" /> Anlegen
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : users.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Keine Mitarbeiter gefunden
        </p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-20">Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Vertrag</TableHead>
                <TableHead>h/W · Urlaub</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const contractInfo = CONTRACT_TYPES[user.contractType as keyof typeof CONTRACT_TYPES];
                return (
                  <TableRow key={user.id} className="hover:bg-muted/10">
                    <TableCell className="font-mono text-sm">{user.employeeNumber ?? "—"}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{user.dept?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {contractInfo?.label ?? user.contractType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.workingTimeConfig
                        ? `${user.workingTimeConfig.hoursPerWeek}h · ${user.workingTimeConfig.vacationDays}T`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((r) => (
                          <Badge key={r.role.name} variant="outline" className="text-xs">
                            {r.role.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                        {user.isActive ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Build + Commit**
```bash
npm run build
git add -A
git commit -m "feat: add employee search with filters and improved user table"
```

---

## Task 6: CSV-Import

**Files:**
- Install: `npm install papaparse`
- Install: `npm install -D @types/papaparse`
- Create: `src/app/api/admin/users/import/route.ts`
- Create: `src/components/admin/csv-import.tsx`
- Modify: `src/app/dashboard/mitarbeiter/page.tsx`

**Step 1: Package installieren**
```bash
npm install papaparse
npm install -D @types/papaparse
```

**Step 2: `src/app/api/admin/users/import/route.ts`**
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { CONTRACT_TYPES } from "@/lib/contract-types";

interface CsvRow {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  department?: string;
  contractType?: string;
  hoursPerWeek?: string;
  vacationDays?: string;
  startDate?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { rows }: { rows: CsvRow[] } = await req.json();

  if (!rows?.length) return NextResponse.json({ error: "Keine Daten" }, { status: 400 });

  const results = { created: 0, skipped: 0, errors: [] as string[] };
  const defaultHash = await bcrypt.hash("Start2026!", 12);

  for (const row of rows) {
    if (!row.employeeNumber || !row.firstName || !row.lastName) {
      results.errors.push(`Zeile übersprungen: employeeNumber/firstName/lastName fehlt`);
      results.skipped++;
      continue;
    }

    const existing = await db.user.findUnique({ where: { employeeNumber: row.employeeNumber } });
    if (existing) {
      results.errors.push(`Nr. ${row.employeeNumber} bereits vorhanden — übersprungen`);
      results.skipped++;
      continue;
    }

    const contractType = (row.contractType ?? "FULLTIME").toUpperCase();
    const template = CONTRACT_TYPES[contractType as keyof typeof CONTRACT_TYPES] ?? CONTRACT_TYPES.FULLTIME;

    // Abteilung finden/erstellen
    let departmentId: string | undefined;
    if (row.department?.trim()) {
      const dept = await db.department.upsert({
        where: { name: row.department.trim() },
        update: {},
        create: { name: row.department.trim() },
      });
      departmentId = dept.id;
    }

    try {
      const user = await db.user.create({
        data: {
          name: `${row.firstName.trim()} ${row.lastName.trim()}`,
          email: row.email?.trim() || null,
          passwordHash: defaultHash,
          employeeNumber: row.employeeNumber.trim(),
          contractType,
          departmentId,
          startDate: row.startDate ? new Date(row.startDate) : null,
          mustChangePassword: true,
          isActive: true,
        },
      });

      await db.workingTimeConfig.create({
        data: {
          userId: user.id,
          hoursPerWeek: parseFloat(row.hoursPerWeek ?? String(template.hoursPerWeek)),
          hoursPerDay: template.hoursPerDay,
          vacationDays: parseInt(row.vacationDays ?? String(template.vacationDays)),
          breakMinutes: 30,
        },
      });

      results.created++;
    } catch (e) {
      results.errors.push(`Nr. ${row.employeeNumber}: ${String(e)}`);
      results.skipped++;
    }
  }

  return NextResponse.json(results, { status: 201 });
}
```

**Step 3: `src/components/admin/csv-import.tsx`**
```tsx
"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  onSuccess: () => void;
}

interface CsvRow {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  department?: string;
  contractType?: string;
  hoursPerWeek?: string;
  vacationDays?: string;
  startDate?: string;
}

const TEMPLATE = `employeeNumber,firstName,lastName,email,department,contractType,hoursPerWeek,vacationDays,startDate
1001,Max,Mustermann,max@firma.de,Büro,FULLTIME,40,28,2024-01-01
1002,Jana,Kluge,,Stadion,PARTTIME,20,14,2024-03-15`;

export function CsvImport({ onSuccess }: Props) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data),
    });
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mitarbeiter-vorlage.csv";
    a.click();
  }

  async function handleImport() {
    setLoading(true);
    const res = await fetch("/api/admin/users/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
    if (data.created > 0) onSuccess();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">CSV-Import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Vorlage herunterladen
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> CSV auswählen
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>

        {rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {rows.length} Mitarbeiter erkannt — Vorschau:
            </p>
            <div className="max-h-40 overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-2">Nr.</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Abteilung</th>
                    <th className="text-left p-2">Vertrag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="p-2 font-mono">{r.employeeNumber}</td>
                      <td className="p-2">{r.firstName} {r.lastName}</td>
                      <td className="p-2">{r.department ?? "—"}</td>
                      <td className="p-2">{r.contractType ?? "FULLTIME"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={handleImport} disabled={loading} className="w-full">
              {loading ? "Importiere..." : `${rows.length} Mitarbeiter importieren`}
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Badge className="bg-green-600 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {result.created} angelegt
              </Badge>
              {result.skipped > 0 && (
                <Badge variant="secondary">{result.skipped} übersprungen</Badge>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    {e}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 4: Mitarbeiter-Seite mit CSV-Import-Tab erweitern**

In `src/app/dashboard/mitarbeiter/page.tsx`:
```tsx
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { UserTableWrapper } from "@/components/admin/user-table-wrapper";

export default async function MitarbeiterPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = await hasPermission(session.user.id, "employees", "read", "all");
  if (!canRead) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mitarbeiterverwaltung</h1>
      <UserTableWrapper />
    </div>
  );
}
```

Erstelle `src/components/admin/user-table-wrapper.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserTable } from "@/components/admin/user-table";
import { CsvImport } from "@/components/admin/csv-import";

export function UserTableWrapper() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Tabs defaultValue="list">
      <TabsList>
        <TabsTrigger value="list">Mitarbeiter</TabsTrigger>
        <TabsTrigger value="import">CSV-Import</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="mt-4">
        <UserTable key={refreshKey} />
      </TabsContent>
      <TabsContent value="import" className="mt-4 max-w-2xl">
        <CsvImport onSuccess={() => setRefreshKey((k) => k + 1)} />
      </TabsContent>
    </Tabs>
  );
}
```

**Step 5: Build + Commit**
```bash
npm run build
git add -A
git commit -m "feat: add CSV import for bulk employee creation with template download"
```

---

## Task 7: Passwort-Selbstverwaltung (/dashboard/profil)

**Files:**
- Create: `src/app/dashboard/profil/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/header.tsx`

**Step 1: `src/app/dashboard/profil/page.tsx`**
```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfilPage() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) { setError("Passwörter stimmen nicht überein"); return; }
    if (newPw.length < 8) { setError("Mindestens 8 Zeichen erforderlich"); return; }

    setLoading(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
    });

    if (res.ok) {
      setSuccess(true);
      setCurrent(""); setNewPw(""); setConfirm("");
    } else {
      const data = await res.json();
      setError(data.error ?? "Fehler");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-2xl font-semibold">Mein Profil</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passwort ändern</CardTitle>
          <CardDescription>Mindestens 8 Zeichen</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Aktuelles Passwort</Label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label>Passwort bestätigen</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-400">Passwort erfolgreich geändert!</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird geändert..." : "Passwort ändern"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Profil-Link in Header-Dropdown**

In `src/components/layout/header.tsx` — füge im DropdownMenu vor "Abmelden" hinzu:
```tsx
import { useRouter } from "next/navigation";
// ...
const router = useRouter();
// In DropdownMenuContent:
<DropdownMenuItem onClick={() => router.push("/dashboard/profil")}>
  <User className="mr-2 h-4 w-4" />
  Mein Profil
</DropdownMenuItem>
<DropdownMenuSeparator />
```
Importiere `User` aus lucide-react.

**Step 3: Build + Commit**
```bash
npm run build
git add -A
git commit -m "feat: add employee self-service profile page with password change"
```

---

## Abschluss-Checkliste Phase 3

- [ ] DB-Migration: WorkingTimeConfig, Department, User-Erweiterungen
- [ ] Login per Mitarbeiternummer funktioniert
- [ ] Erstlogin zeigt Passwort-Änderungs-Seite
- [ ] Abteilungen anlegen/löschen in Einstellungen
- [ ] Mitarbeiter anlegen via 3-Schritt-Wizard
- [ ] Suche nach Name/Nummer/Abteilung funktioniert
- [ ] CSV-Import mit Vorlagen-Download
- [ ] Passwort-Selbstverwaltung unter /dashboard/profil
- [ ] `npm run build` ohne Fehler
