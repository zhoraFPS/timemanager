# Zeiterfassung MVP — Implementierungsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Atoss Time Control Alternative — Zeiterfassung, Antragswesen, RBAC für 500+ Mitarbeiter

**Architecture:** Next.js 15 Full-Stack App mit App Router, Prisma ORM auf PostgreSQL, Auth.js für Authentifizierung, shadcn/ui (new-york, dark) für alle UI-Komponenten. Alles in Docker Compose für on-premise Hosting.

**Tech Stack:** Next.js 15, TypeScript, shadcn/ui, Tailwind v4, Prisma, PostgreSQL, Auth.js v5, Docker Compose, Vitest

---

## Task 1: Projekt initialisieren

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json` (via CLI)
- Create: `components.json` (via shadcn)
- Create: `docker-compose.yml`
- Create: `.env.local`
- Create: `.env.example`

**Step 1: Next.js Projekt erstellen**

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git --turbopack
```

Expected: Projekt-Dateien werden erstellt.

**Step 2: shadcn/ui initialisieren**

```bash
npx shadcn@latest init -d
```

Expected: `components.json` erstellt, `src/lib/utils.ts` erstellt.

**Step 3: shadcn Kern-Komponenten installieren**

```bash
npx shadcn@latest add button card input label badge avatar table tabs dialog alert-dialog sheet dropdown-menu select textarea separator skeleton toast command popover calendar
```

Expected: Alle Komponenten in `src/components/ui/` verfügbar.

**Step 4: Abhängigkeiten installieren**

```bash
npm install next-auth@beta @auth/prisma-adapter prisma @prisma/client bcryptjs date-fns
npm install -D @types/bcryptjs vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

**Step 5: `.env.local` erstellen**

```env
DATABASE_URL="postgresql://zeiterfassung:password@localhost:5432/zeiterfassung"
NEXTAUTH_SECRET="supersecret-change-in-production-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

**Step 6: `.env.example` erstellen**

```env
DATABASE_URL="postgresql://zeiterfassung:password@localhost:5432/zeiterfassung"
NEXTAUTH_SECRET="supersecret-change-in-production-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

**Step 7: `docker-compose.yml` erstellen**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: zeiterfassung
      POSTGRES_USER: zeiterfassung
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://zeiterfassung:password@db:5432/zeiterfassung
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
    depends_on:
      - db

volumes:
  postgres_data:
```

**Step 8: `Dockerfile` erstellen**

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 9: `next.config.ts` für standalone Output anpassen**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

**Step 10: globals.css — Font-Fix nach shadcn init**

In `src/app/globals.css` im `@theme inline` Block sicherstellen:
```css
--font-sans: ui-sans-serif, system-ui, sans-serif;
--font-mono: ui-monospace, monospace;
```

Keine `var(--font-*)` Referenzen im `@theme inline` Block.

**Step 11: PostgreSQL starten**

```bash
docker-compose up -d db
```

Expected: PostgreSQL läuft auf Port 5432.

**Step 12: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js project with shadcn/ui and Docker"
```

---

## Task 2: Datenbankschema (Prisma)

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Step 1: Prisma initialisieren**

```bash
npx prisma init --datasource-provider postgresql
```

**Step 2: Schema schreiben**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String
  employeeId   String?   @unique
  managerId    String?
  department   String?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  manager      User?     @relation("UserManager", fields: [managerId], references: [id])
  reports      User[]    @relation("UserManager")
  roles        UserRole[]
  timeEntries  TimeEntry[]
  requests     Request[]
  approvals    RequestApproval[]
  accounts     Account[]
  sessions     Session[]
  workingTimeAccountId String?
  workingTimeModelId   String?
  workingTimeModel     WorkingTimeModel? @relation(fields: [workingTimeModelId], references: [id])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model Role {
  id          String           @id @default(cuid())
  name        String           @unique
  description String?
  isSystem    Boolean          @default(false)
  createdAt   DateTime         @default(now())
  permissions RolePermission[]
  users       UserRole[]
}

model RolePermission {
  id       String @id @default(cuid())
  roleId   String
  resource String
  action   String
  scope    String @default("own")
  role     Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@unique([roleId, resource, action, scope])
}

model UserRole {
  userId    String
  roleId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  @@id([userId, roleId])
}

model TimeEntry {
  id          String    @id @default(cuid())
  userId      String
  clockIn     DateTime
  clockOut    DateTime?
  breakMinutes Int?
  note        String?
  type        String    @default("WORK")
  correctedBy String?
  correctedAt DateTime?
  createdAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id])
}

model Request {
  id        String            @id @default(cuid())
  userId    String
  type      String
  dateFrom  DateTime
  dateTo    DateTime
  status    String            @default("PENDING")
  payload   Json?
  note      String?
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  user      User              @relation(fields: [userId], references: [id])
  approvals RequestApproval[]
}

model RequestApproval {
  id         String   @id @default(cuid())
  requestId  String
  approverId String
  status     String
  comment    String?
  decidedAt  DateTime @default(now())
  request    Request  @relation(fields: [requestId], references: [id])
  approver   User     @relation(fields: [approverId], references: [id])
}

model WorkingTimeAccount {
  id            String   @id @default(cuid())
  userId        String
  date          DateTime @db.Date
  targetHours   Float
  actualHours   Float    @default(0)
  balance       Float    @default(0)
  vacationDays  Float    @default(0)
  overtimeHours Float    @default(0)
  updatedAt     DateTime @updatedAt
  @@unique([userId, date])
}

model WorkingTimeModel {
  id                  String  @id @default(cuid())
  name                String  @unique
  hoursPerDay         Float   @default(8.0)
  hoursPerWeek        Float   @default(40.0)
  breakMinutes        Int     @default(30)
  vacationDaysPerYear Int     @default(28)
  users               User[]
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  action     String
  resource   String
  resourceId String
  oldValue   Json?
  newValue   Json?
  createdAt  DateTime @default(now())
}
```

**Step 3: Prisma Client Singleton erstellen**

`src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Step 4: Migration erstellen und ausführen**

```bash
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/` Ordner erstellt, Tabellen in DB angelegt.

**Step 5: Seed-Script erstellen**

`prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // Arbeitszeitmodell
  const defaultModel = await db.workingTimeModel.upsert({
    where: { name: "Standard 40h" },
    update: {},
    create: {
      name: "Standard 40h",
      hoursPerDay: 8.0,
      hoursPerWeek: 40.0,
      breakMinutes: 30,
      vacationDaysPerYear: 28,
    },
  });

  // SuperAdmin Rolle
  const superAdminRole = await db.role.upsert({
    where: { name: "SUPERADMIN" },
    update: {},
    create: {
      name: "SUPERADMIN",
      description: "Vollzugriff auf alle Funktionen",
      isSystem: true,
      permissions: {
        create: [
          { resource: "time_entries", action: "read", scope: "all" },
          { resource: "time_entries", action: "write", scope: "all" },
          { resource: "time_entries", action: "export", scope: "all" },
          { resource: "requests", action: "read", scope: "all" },
          { resource: "requests", action: "write", scope: "all" },
          { resource: "requests", action: "approve", scope: "all" },
          { resource: "employees", action: "read", scope: "all" },
          { resource: "employees", action: "write", scope: "all" },
          { resource: "reports", action: "read", scope: "all" },
          { resource: "reports", action: "export", scope: "all" },
          { resource: "roles", action: "read", scope: "all" },
          { resource: "roles", action: "write", scope: "all" },
        ],
      },
    },
  });

  // HR Admin Rolle
  await db.role.upsert({
    where: { name: "HR_ADMIN" },
    update: {},
    create: {
      name: "HR_ADMIN",
      description: "Personalverwaltung und Zeitkorrekturen",
      isSystem: true,
      permissions: {
        create: [
          { resource: "time_entries", action: "read", scope: "all" },
          { resource: "time_entries", action: "write", scope: "all" },
          { resource: "time_entries", action: "export", scope: "all" },
          { resource: "requests", action: "read", scope: "all" },
          { resource: "requests", action: "approve", scope: "all" },
          { resource: "employees", action: "read", scope: "all" },
          { resource: "employees", action: "write", scope: "all" },
          { resource: "reports", action: "read", scope: "all" },
          { resource: "reports", action: "export", scope: "all" },
        ],
      },
    },
  });

  // Manager Rolle
  await db.role.upsert({
    where: { name: "MANAGER" },
    update: {},
    create: {
      name: "MANAGER",
      description: "Teamleitung — Anträge genehmigen",
      isSystem: true,
      permissions: {
        create: [
          { resource: "time_entries", action: "read", scope: "team" },
          { resource: "requests", action: "read", scope: "team" },
          { resource: "requests", action: "approve", scope: "team" },
          { resource: "reports", action: "read", scope: "team" },
        ],
      },
    },
  });

  // Employee Rolle
  await db.role.upsert({
    where: { name: "EMPLOYEE" },
    update: {},
    create: {
      name: "EMPLOYEE",
      description: "Mitarbeiter — Standardzugriff",
      isSystem: true,
      permissions: {
        create: [
          { resource: "time_entries", action: "read", scope: "own" },
          { resource: "time_entries", action: "write", scope: "own" },
          { resource: "requests", action: "read", scope: "own" },
          { resource: "requests", action: "write", scope: "own" },
        ],
      },
    },
  });

  // SuperAdmin User
  const passwordHash = await bcrypt.hash("admin123", 12);
  const adminUser = await db.user.upsert({
    where: { email: "admin@firma.de" },
    update: {},
    create: {
      email: "admin@firma.de",
      name: "System Admin",
      passwordHash,
      workingTimeModelId: defaultModel.id,
    },
  });

  await db.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRole.id },
  });

  console.log("Seed erfolgreich. Admin: admin@firma.de / admin123");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
```

`package.json` — prisma seed ergänzen:
```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

```bash
npm install -D ts-node
npx prisma db seed
```

Expected: Admin-User und alle Rollen in DB vorhanden.

**Step 6: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: add Prisma schema with RBAC, time entries, and requests"
```

---

## Task 3: Authentifizierung (Auth.js v5)

**Files:**
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/lib/permissions.ts`

**Step 1: Auth.js konfigurieren**

`src/auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            roles: {
              include: {
                role: { include: { permissions: true } },
              },
            },
          },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

**Step 2: Auth Route Handler**

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

**Step 3: Middleware**

`src/middleware.ts`:

```ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 4: Permission-Hilfsfunktionen**

`src/lib/permissions.ts`:

```ts
import { db } from "@/lib/db";

export type Resource = "time_entries" | "requests" | "employees" | "reports" | "roles";
export type Action = "read" | "write" | "approve" | "export";
export type Scope = "own" | "team" | "all";

export async function getUserPermissions(userId: string) {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: true } } },
  });

  const permissions = userRoles.flatMap((ur) => ur.role.permissions);
  return permissions;
}

export async function hasPermission(
  userId: string,
  resource: Resource,
  action: Action,
  requiredScope?: Scope
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);

  return permissions.some((p) => {
    if (p.resource !== resource || p.action !== action) return false;
    if (!requiredScope) return true;
    // "all" deckt alles ab, "team" deckt "own" und "team" ab
    if (p.scope === "all") return true;
    if (p.scope === "team" && requiredScope !== "all") return true;
    return p.scope === requiredScope;
  });
}

export async function getPermissionScope(
  userId: string,
  resource: Resource,
  action: Action
): Promise<Scope | null> {
  const permissions = await getUserPermissions(userId);

  const match = permissions
    .filter((p) => p.resource === resource && p.action === action)
    .sort((a, b) => {
      const order = { all: 0, team: 1, own: 2 };
      return order[a.scope as Scope] - order[b.scope as Scope];
    })[0];

  return (match?.scope as Scope) ?? null;
}
```

**Step 5: Login-Seite erstellen**

`src/app/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoginForm />
    </div>
  );
}
```

`src/components/auth/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("E-Mail oder Passwort falsch.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Zeiterfassung</CardTitle>
        <CardDescription>Mit deinem Firmen-Account anmelden</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Anmelden..." : "Anmelden"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 6: App Layout mit dark mode**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zeiterfassung",
  description: "Mitarbeiter Zeiterfassung",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

**Step 7: TypeScript Typen für Session erweitern**

`src/types/next-auth.d.ts`:

```ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
    };
  }
}
```

**Step 8: Dev-Server starten und Login testen**

```bash
npm run dev
```

Browser: `http://localhost:3000/login`
Login mit: `admin@firma.de` / `admin123`
Expected: Redirect auf `/dashboard`

**Step 9: Commit**

```bash
git add src/auth.ts src/middleware.ts src/app/ src/lib/permissions.ts src/types/ src/components/auth/
git commit -m "feat: add Auth.js authentication with credentials provider and RBAC permissions"
```

---

## Task 4: Dashboard Layout & Navigation

**Files:**
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`

**Step 1: Dashboard Layout**

`src/app/dashboard/layout.tsx`:

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

**Step 2: Sidebar**

`src/components/layout/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Clock, CalendarDays, FileText, Users, Shield, BarChart3, Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: Clock, label: "Dashboard" },
  { href: "/dashboard/zeitübersicht", icon: CalendarDays, label: "Zeitübersicht" },
  { href: "/dashboard/anträge", icon: FileText, label: "Anträge" },
  { href: "/dashboard/team", icon: Users, label: "Team" },
  { href: "/dashboard/auswertungen", icon: BarChart3, label: "Auswertungen" },
  { href: "/dashboard/mitarbeiter", icon: Users, label: "Mitarbeiter" },
  { href: "/dashboard/rollen", icon: Shield, label: "Rollen" },
  { href: "/dashboard/einstellungen", icon: Settings, label: "Einstellungen" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-lg font-semibold">Zeiterfassung</h1>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

**Step 3: Header**

`src/components/layout/header.tsx`:

```tsx
"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

interface HeaderProps {
  user: { name: string; email: string };
}

export function Header({ user }: HeaderProps) {
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <header className="h-14 border-b border-border flex items-center justify-end px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{user.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/dashboard/ src/components/layout/
git commit -m "feat: add dashboard layout with sidebar navigation and header"
```

---

## Task 5: Stempeluhr (Zeiterfassung)

**Files:**
- Create: `src/app/api/time-entries/route.ts`
- Create: `src/app/api/time-entries/active/route.ts`
- Create: `src/components/dashboard/clock-widget.tsx`
- Create: `src/app/dashboard/page.tsx`

**Step 1: API — Aktiven Eintrag abrufen**

`src/app/api/time-entries/active/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await db.timeEntry.findFirst({
    where: { userId: session.user.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  });

  return NextResponse.json({ entry: active });
}
```

**Step 2: API — Einstempeln / Ausstempeln**

`src/app/api/time-entries/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // Prüfen ob bereits eingestempelt
  const active = await db.timeEntry.findFirst({
    where: { userId, clockOut: null },
  });

  if (active) {
    // Ausstempeln
    const updated = await db.timeEntry.update({
      where: { id: active.id },
      data: { clockOut: new Date() },
    });
    return NextResponse.json({ action: "clockOut", entry: updated });
  } else {
    // Einstempeln
    const entry = await db.timeEntry.create({
      data: { userId, clockIn: new Date(), type: "WORK" },
    });
    return NextResponse.json({ action: "clockIn", entry });
  }
}
```

**Step 3: Stempeluhr-Widget**

`src/components/dashboard/clock-widget.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { de } from "date-fns/locale";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
}

export function ClockWidget() {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchActive = useCallback(async () => {
    const res = await fetch("/api/time-entries/active");
    const data = await res.json();
    setActiveEntry(data.entry);
    setLoading(false);
  }, []);

  useEffect(() => { fetchActive(); }, [fetchActive]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleClock() {
    setActing(true);
    await fetch("/api/time-entries", { method: "POST" });
    await fetchActive();
    setActing(false);
  }

  const elapsed = activeEntry
    ? differenceInSeconds(now, new Date(activeEntry.clockIn))
    : 0;
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const elapsedStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isClockedIn = !!activeEntry;

  return (
    <Card className="col-span-2">
      <CardContent className="p-8 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{format(now, "EEEE, dd. MMMM yyyy · HH:mm:ss", { locale: de })}</span>
        </div>

        {!loading && (
          <>
            {isClockedIn ? (
              <div className="text-center space-y-2">
                <Badge variant="default" className="bg-green-600">Eingestempelt</Badge>
                <p className="text-muted-foreground text-sm">
                  seit {format(new Date(activeEntry!.clockIn), "HH:mm")} Uhr
                </p>
                <p className="text-4xl font-mono font-bold">{elapsedStr}</p>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <Badge variant="secondary">Ausgestempelt</Badge>
                <p className="text-muted-foreground text-sm">Noch nicht eingestempelt</p>
              </div>
            )}

            <Button
              size="lg"
              variant={isClockedIn ? "destructive" : "default"}
              onClick={handleClock}
              disabled={acting}
              className="w-48 h-12 text-base"
            >
              {acting ? "..." : isClockedIn ? "Ausstempeln" : "Einstempeln"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 4: Dashboard Hauptseite**

`src/app/dashboard/page.tsx`:

```tsx
import { ClockWidget } from "@/components/dashboard/clock-widget";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-4 gap-4">
        <ClockWidget />
      </div>
    </div>
  );
}
```

**Step 5: Testen**

```bash
npm run dev
```

- Login als admin → Dashboard
- "Einstempeln" klicken → Badge wird grün, Timer startet
- "Ausstempeln" klicken → Badge wird grau

**Step 6: Commit**

```bash
git add src/app/api/time-entries/ src/components/dashboard/ src/app/dashboard/page.tsx
git commit -m "feat: add clock-in/clock-out widget with live timer"
```

---

## Task 6: Antragswesen

**Files:**
- Create: `src/app/api/requests/route.ts`
- Create: `src/app/dashboard/anträge/page.tsx`
- Create: `src/components/requests/request-form.tsx`
- Create: `src/components/requests/request-list.tsx`

**Step 1: API — Anträge erstellen und abrufen**

`src/app/api/requests/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await db.request.findMany({
    where: { userId: session.user.id },
    include: { approvals: { include: { approver: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, dateFrom, dateTo, note, payload } = body;

  if (!type || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  }

  const request = await db.request.create({
    data: {
      userId: session.user.id,
      type,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      note,
      payload,
      status: "PENDING",
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}
```

**Step 2: Request Types Konstanten**

`src/lib/request-types.ts`:

```ts
export const REQUEST_TYPES = {
  VACATION: { label: "Urlaub", color: "bg-blue-500" },
  SICK: { label: "Krankmeldung", color: "bg-red-500" },
  HOMEOFFICE: { label: "Homeoffice", color: "bg-purple-500" },
  TIME_CORRECTION: { label: "Zeitkorrektur", color: "bg-yellow-500" },
  OVERTIME_REDUCE: { label: "Überstundenabbau", color: "bg-orange-500" },
  SPECIAL_LEAVE: { label: "Sonderurlaub", color: "bg-pink-500" },
} as const;

export type RequestType = keyof typeof REQUEST_TYPES;

export const STATUS_LABELS = {
  PENDING: { label: "Ausstehend", variant: "secondary" as const },
  APPROVED: { label: "Genehmigt", variant: "default" as const },
  REJECTED: { label: "Abgelehnt", variant: "destructive" as const },
  CANCELLED: { label: "Storniert", variant: "outline" as const },
};
```

**Step 3: Antrags-Formular**

`src/components/requests/request-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { REQUEST_TYPES, RequestType } from "@/lib/request-types";

interface RequestFormProps {
  onSuccess: () => void;
}

export function RequestForm({ onSuccess }: RequestFormProps) {
  const [type, setType] = useState<RequestType>("VACATION");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, dateFrom, dateTo, note }),
    });

    if (res.ok) {
      onSuccess();
    } else {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Erstellen des Antrags");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuer Antrag</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Antragstyp</Label>
            <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REQUEST_TYPES).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Von</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Bis</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Anmerkung (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Wird eingereicht..." : "Antrag einreichen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Antragsliste**

`src/components/requests/request-list.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { REQUEST_TYPES, STATUS_LABELS } from "@/lib/request-types";
import { Skeleton } from "@/components/ui/skeleton";

interface Request {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface RequestListProps {
  refreshKey: number;
}

export function RequestList({ refreshKey }: RequestListProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/requests")
      .then((r) => r.json())
      .then((d) => { setRequests(d.requests); setLoading(false); });
  }, [refreshKey]);

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
    </div>
  );

  if (requests.length === 0) return (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground">
        Keine Anträge vorhanden
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const typeInfo = REQUEST_TYPES[req.type as keyof typeof REQUEST_TYPES];
        const statusInfo = STATUS_LABELS[req.status as keyof typeof STATUS_LABELS];
        return (
          <Card key={req.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{typeInfo?.label ?? req.type}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(req.dateFrom), "dd.MM.yyyy", { locale: de })}
                  {" – "}
                  {format(new Date(req.dateTo), "dd.MM.yyyy", { locale: de })}
                </p>
                {req.note && <p className="text-sm text-muted-foreground mt-1">{req.note}</p>}
              </div>
              <Badge variant={statusInfo?.variant}>{statusInfo?.label ?? req.status}</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

**Step 5: Anträge-Seite**

`src/app/dashboard/anträge/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { RequestForm } from "@/components/requests/request-form";
import { RequestList } from "@/components/requests/request-list";

export default function AnträgePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Meine Anträge</h1>
      <RequestForm onSuccess={() => setRefreshKey((k) => k + 1)} />
      <RequestList refreshKey={refreshKey} />
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add src/app/api/requests/ src/app/dashboard/anträge/ src/components/requests/ src/lib/request-types.ts
git commit -m "feat: add request system with form and list for all request types"
```

---

## Task 7: Genehmigungsworkflow (Manager)

**Files:**
- Create: `src/app/api/requests/[id]/approve/route.ts`
- Create: `src/app/dashboard/team/page.tsx`
- Create: `src/components/team/approval-list.tsx`

**Step 1: API — Antrag genehmigen/ablehnen**

`src/app/api/requests/[id]/approve/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canApprove = await hasPermission(session.user.id, "requests", "approve");
  if (!canApprove) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const { status, comment } = body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const request = await db.request.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: "Antrag nicht gefunden" }, { status: 404 });

  const [approval] = await db.$transaction([
    db.requestApproval.create({
      data: {
        requestId: params.id,
        approverId: session.user.id,
        status,
        comment,
      },
    }),
    db.request.update({
      where: { id: params.id },
      data: { status },
    }),
  ]);

  return NextResponse.json({ approval });
}
```

**Step 2: Team-API — Offene Anträge**

`src/app/api/team/requests/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canApprove = await hasPermission(session.user.id, "requests", "approve");
  if (!canApprove) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  // Hole Team des Managers
  const teamMembers = await db.user.findMany({
    where: { managerId: session.user.id },
    select: { id: true },
  });

  const teamIds = teamMembers.map((m) => m.id);

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
```

**Step 3: Approval-Liste Komponente**

`src/components/team/approval-list.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { REQUEST_TYPES } from "@/lib/request-types";
import { Check, X } from "lucide-react";

interface Request {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  note: string | null;
  user: { name: string; email: string };
}

export function ApprovalList() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  async function fetchRequests() {
    const res = await fetch("/api/team/requests");
    const data = await res.json();
    setRequests(data.requests ?? []);
  }

  useEffect(() => { fetchRequests(); }, []);

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setActing(id);
    await fetch(`/api/requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment: comments[id] }),
    });
    await fetchRequests();
    setActing(null);
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Keine offenen Anträge
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => {
        const typeInfo = REQUEST_TYPES[req.type as keyof typeof REQUEST_TYPES];
        return (
          <Card key={req.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{req.user.name}</p>
                  <p className="text-sm text-muted-foreground">{typeInfo?.label ?? req.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(req.dateFrom), "dd.MM.yyyy", { locale: de })}
                    {" – "}
                    {format(new Date(req.dateTo), "dd.MM.yyyy", { locale: de })}
                  </p>
                  {req.note && <p className="text-sm mt-1">{req.note}</p>}
                </div>
                <Badge variant="secondary">Ausstehend</Badge>
              </div>
              <Textarea
                placeholder="Kommentar (optional)"
                rows={2}
                value={comments[req.id] ?? ""}
                onChange={(e) => setComments((c) => ({ ...c, [req.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => decide(req.id, "APPROVED")}
                  disabled={acting === req.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" /> Genehmigen
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => decide(req.id, "REJECTED")}
                  disabled={acting === req.id}
                >
                  <X className="h-4 w-4 mr-1" /> Ablehnen
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

**Step 4: Team-Seite**

`src/app/dashboard/team/page.tsx`:

```tsx
import { ApprovalList } from "@/components/team/approval-list";

export default function TeamPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Team — Offene Anträge</h1>
      <ApprovalList />
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/app/api/requests/ src/app/api/team/ src/app/dashboard/team/ src/components/team/
git commit -m "feat: add manager approval workflow for team requests"
```

---

## Task 8: HR Admin — Zeitkorrekturen & Mitarbeiterverwaltung

**Files:**
- Create: `src/app/api/admin/time-entries/route.ts`
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/dashboard/mitarbeiter/page.tsx`

**Step 1: API — HR Zeitkorrektur**

`src/app/api/admin/time-entries/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "time_entries", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const { userId, clockIn, clockOut, note } = body;

  // Audit Log
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      resource: "time_entries",
      resourceId: userId,
      newValue: { userId, clockIn, clockOut, note },
    },
  });

  const entry = await db.timeEntry.create({
    data: {
      userId,
      clockIn: new Date(clockIn),
      clockOut: clockOut ? new Date(clockOut) : null,
      note,
      correctedBy: session.user.id,
      correctedAt: new Date(),
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
```

**Step 2: API — Mitarbeiter verwalten**

`src/app/api/admin/users/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "employees", "read", "all");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const users = await db.user.findMany({
    select: {
      id: true, name: true, email: true, department: true,
      isActive: true, employeeId: true, createdAt: true,
      manager: { select: { name: true } },
      roles: { include: { role: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const { name, email, password, department, employeeId, managerId, roleId } = body;

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name, email, passwordHash, department, employeeId, managerId,
      roles: roleId ? { create: { roleId } } : undefined,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
```

**Step 3: Mitarbeiter-Seite (vereinfacht)**

`src/app/dashboard/mitarbeiter/page.tsx`:

```tsx
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/admin/user-table";

export default async function MitarbeiterPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = await hasPermission(session.user.id, "employees", "read", "all");
  if (!canRead) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mitarbeiterverwaltung</h1>
      <UserTable />
    </div>
  );
}
```

`src/components/admin/user-table.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface User {
  id: string;
  name: string;
  email: string;
  department: string | null;
  isActive: boolean;
  employeeId: string | null;
  manager: { name: string } | null;
  roles: { role: { name: string } }[];
}

export function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoading(false); });
  }, []);

  if (loading) return <Skeleton className="h-64" />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>E-Mail</TableHead>
          <TableHead>Abteilung</TableHead>
          <TableHead>Manager</TableHead>
          <TableHead>Rolle</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.department ?? "—"}</TableCell>
            <TableCell>{user.manager?.name ?? "—"}</TableCell>
            <TableCell>
              {user.roles.map((r) => (
                <Badge key={r.role.name} variant="outline" className="mr-1">
                  {r.role.name}
                </Badge>
              ))}
            </TableCell>
            <TableCell>
              <Badge variant={user.isActive ? "default" : "secondary"}>
                {user.isActive ? "Aktiv" : "Inaktiv"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/api/admin/ src/app/dashboard/mitarbeiter/ src/components/admin/
git commit -m "feat: add HR admin user management and time correction API"
```

---

## Task 9: SuperAdmin — Rollenverwaltung

**Files:**
- Create: `src/app/api/admin/roles/route.ts`
- Create: `src/app/dashboard/rollen/page.tsx`
- Create: `src/components/admin/role-manager.tsx`

**Step 1: Rollen API**

`src/app/api/admin/roles/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "roles", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const roles = await db.role.findMany({
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ roles });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "roles", "write");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const body = await req.json();
  const { name, description, permissions } = body;

  const role = await db.role.create({
    data: {
      name,
      description,
      permissions: {
        create: permissions.map((p: { resource: string; action: string; scope: string }) => p),
      },
    },
    include: { permissions: true },
  });

  return NextResponse.json({ role }, { status: 201 });
}
```

**Step 2: Rollenverwaltung Seite**

`src/app/dashboard/rollen/page.tsx`:

```tsx
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { RoleManager } from "@/components/admin/role-manager";

export default async function RollenPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = await hasPermission(session.user.id, "roles", "read");
  if (!canRead) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rollenverwaltung</h1>
      <RoleManager />
    </div>
  );
}
```

**Step 3: RoleManager Komponente**

`src/components/admin/role-manager.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Users } from "lucide-react";

const RESOURCES = ["time_entries", "requests", "employees", "reports", "roles"];
const ACTIONS = ["read", "write", "approve", "export"];
const SCOPES = ["own", "team", "all"];

interface Permission {
  resource: string;
  action: string;
  scope: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  _count: { users: number };
}

export function RoleManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((d) => { setRoles(d.roles ?? []); setLoading(false); });
  }, []);

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {roles.map((role) => (
        <Card key={role.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                {role.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                {role.isSystem && <Badge variant="outline">System</Badge>}
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {role._count.users}
                </Badge>
              </div>
            </div>
            {role.description && (
              <p className="text-sm text-muted-foreground">{role.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {role.permissions.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{p.resource}</Badge>
                  <span>{p.action}</span>
                  <Badge variant="secondary" className="text-xs">{p.scope}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/api/admin/roles/ src/app/dashboard/rollen/ src/components/admin/role-manager.tsx
git commit -m "feat: add SuperAdmin role management UI and API"
```

---

## Task 10: Zeitübersicht

**Files:**
- Create: `src/app/api/time-entries/month/route.ts`
- Create: `src/app/dashboard/zeitübersicht/page.tsx`
- Create: `src/components/time/month-view.tsx`

**Step 1: API — Monatsübersicht**

`src/app/api/time-entries/month/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const date = new Date(year, month - 1, 1);

  const entries = await db.timeEntry.findMany({
    where: {
      userId: session.user.id,
      clockIn: {
        gte: startOfMonth(date),
        lte: endOfMonth(date),
      },
    },
    orderBy: { clockIn: "asc" },
  });

  return NextResponse.json({ entries });
}
```

**Step 2: Monatsansicht Komponente**

`src/components/time/month-view.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, getDaysInMonth, startOfMonth, getDay, differenceInMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
}

export function MonthView() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    fetch(`/api/time-entries/month?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []));
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));

  function getEntriesForDay(day: number) {
    return entries.filter((e) => new Date(e.clockIn).getDate() === day);
  }

  function calcHours(entry: TimeEntry) {
    if (!entry.clockOut) return null;
    const mins = differenceInMinutes(new Date(entry.clockOut), new Date(entry.clockIn));
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-medium w-48 text-center">
          {format(new Date(year, month - 1), "MMMM yyyy", { locale: de })}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = new Date(year, month - 1, day);
          const dayEntries = getEntriesForDay(day);
          const isWeekend = [0, 6].includes(getDay(date));

          return (
            <Card key={day} className={isWeekend ? "opacity-50" : undefined}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24">
                    {format(date, "EEE, dd.MM.", { locale: de })}
                  </span>
                  {dayEntries.length === 0 && !isWeekend && (
                    <span className="text-sm text-muted-foreground">Kein Eintrag</span>
                  )}
                  {dayEntries.map((e) => (
                    <span key={e.id} className="text-sm">
                      {format(new Date(e.clockIn), "HH:mm")}
                      {e.clockOut && ` – ${format(new Date(e.clockOut), "HH:mm")}`}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {dayEntries.map((e) => {
                    const h = calcHours(e);
                    return h ? <Badge key={e.id} variant="outline">{h} h</Badge> : null;
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: Zeitübersicht Seite**

`src/app/dashboard/zeitübersicht/page.tsx`:

```tsx
import { MonthView } from "@/components/time/month-view";

export default function ZeitübersichtPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Zeitübersicht</h1>
      <MonthView />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/api/time-entries/month/ src/app/dashboard/zeitübersicht/ src/components/time/
git commit -m "feat: add monthly time overview with calendar view"
```

---

## Task 11: Production Build & Docker

**Files:**
- Modify: `next.config.ts` (standalone bereits gesetzt)
- Create: `.dockerignore`

**Step 1: `.dockerignore` erstellen**

```
node_modules
.next
.git
.env*
!.env.example
```

**Step 2: Production Build testen**

```bash
npm run build
```

Expected: Build erfolgreich, kein TypeScript-Fehler.

**Step 3: Docker Image bauen**

```bash
docker build -t zeiterfassung:latest .
```

**Step 4: Mit Docker Compose starten**

```bash
docker-compose up -d
```

Expected: App läuft auf `http://localhost:3000`, Datenbank persistent.

**Step 5: Vitest konfigurieren**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom";
```

`package.json` — test script ergänzen:
```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

**Step 6: Permissions testen**

`src/test/permissions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock der DB
vi.mock("@/lib/db", () => ({
  db: {
    userRole: {
      findMany: vi.fn(),
    },
  },
}));

import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";

describe("hasPermission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erlaubt Zugriff wenn scope 'all' vorhanden", async () => {
    (db.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        role: {
          permissions: [
            { resource: "time_entries", action: "read", scope: "all" },
          ],
        },
      },
    ]);

    const result = await hasPermission("user1", "time_entries", "read", "own");
    expect(result).toBe(true);
  });

  it("verweigert Zugriff bei fehlender Permission", async () => {
    (db.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await hasPermission("user1", "roles", "write");
    expect(result).toBe(false);
  });
});
```

```bash
npm test
```

Expected: Alle Tests grün.

**Step 7: Final Commit**

```bash
git add .
git commit -m "feat: add production Docker build and Vitest configuration"
```

---

## MVP Abschluss-Checkliste

- [ ] Login / Logout funktioniert
- [ ] Einstempeln / Ausstempeln mit Live-Timer
- [ ] Monatsübersicht Zeiteinträge
- [ ] Antrag stellen (alle 6 Typen)
- [ ] Manager kann Anträge genehmigen/ablehnen
- [ ] HR Admin sieht alle Mitarbeiter
- [ ] SuperAdmin sieht alle Rollen
- [ ] `docker-compose up` startet alles
- [ ] `npm test` läuft durch
- [ ] `npm run build` ohne Fehler
