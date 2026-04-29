# API/Web Container Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the Next.js monolith into two independent containers — `apps/api` (API routes + DB) and the existing root (web frontend + proxy middleware) — so that the web container has zero database dependencies and the mobile app can target the API container directly.

**Architecture:** Root stays as the web app (minimal churn), a new `apps/api` Next.js app is created with all 76 API route files and DB libs. The web container proxies `/api/*` via Next.js middleware to `API_URL` at runtime. Both containers share `AUTH_SECRET` so the JWT session cookie is readable by both without any DB calls on the web side.

**Tech Stack:** Next.js 16 App Router, NextAuth v5 (JWT strategy), Prisma 7, PostgreSQL, Docker, docker-compose

---

## Key Facts (read before touching code)

- **JWT sessions**: `strategy: "jwt"` — `auth()` on the web side only needs `AUTH_SECRET` to decode the cookie. No DB call needed.
- **Permissions in JWT**: `session.user.permissions` is an array of `"resource:action:scope"` strings already embedded in the token. The web's `hasPermission()` can check this synchronously.
- **Web lib deps**: Components only import `contract-types`, `rbac`, `request-types`, `stamp-types`, `utils`. Dashboard pages additionally import `audit-format`, `permissions`. Nothing else.
- **2 pages with direct DB**: `src/app/dashboard/zeitansicht/page.tsx` and `src/app/dashboard/team/[userId]/page.tsx` — both do a single `db.user.findUnique`. Fix by fetching `GET /api/admin/users/[id]` with forwarded cookies.
- **`GET /api/admin/users/[id]`** currently omits the `department` (String?) field from its select — add it.
- **`entraEnabled`** export from `src/auth.ts` is used by the login page — keep it as a pure env-var check in the web auth.ts (no DB needed).
- **Mobile** already has `EXPO_PUBLIC_API_URL` support. Default port must change from 3000 → 3001.
- **Proxy strategy**: Use Next.js middleware (`src/middleware.ts`), NOT `next.config.ts` rewrites. Middleware runs at request time so `API_URL` is a runtime env var — no Docker build-arg needed.

---

## Task 1: Create `apps/api` scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/next.config.ts`
- Create: `apps/api/src/app/layout.tsx`

**Step 1: Create `apps/api/package.json`**

```json
{
  "name": "vfl-zeitspiel-api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@auth/prisma-adapter": "^2.11.1",
    "@prisma/adapter-pg": "^7.7.0",
    "@prisma/client": "^7.7.0",
    "@sentry/nextjs": "^10.49.0",
    "@types/pg": "^8.20.0",
    "bcryptjs": "^3.0.3",
    "date-fns": "^4.1.0",
    "jose": "^6.2.2",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "next": "16.2.3",
    "next-auth": "^5.0.0-beta.30",
    "nodemailer": "^7.0.13",
    "otpauth": "^9.5.0",
    "papaparse": "^5.5.3",
    "pg": "^8.20.0",
    "prisma": "^7.7.0",
    "qrcode": "^1.5.4",
    "web-push": "^3.6.7"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/nodemailer": "^8.0.0",
    "@types/papaparse": "^5.5.2",
    "@types/qrcode": "^1.5.6",
    "@types/web-push": "^3.6.4",
    "tsx": "^4.21.0",
    "typescript": "^5"
  }
}
```

**Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create `apps/api/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Step 4: Create `apps/api/src/app/layout.tsx`**

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 5: Commit**

```bash
git add apps/api/
git commit -m "feat: scaffold apps/api Next.js app"
```

---

## Task 2: Move `prisma/` into `apps/api/`

**Files:**
- Move: `prisma/` → `apps/api/prisma/`
- Modify: root `package.json` (remove prisma seed script)

**Step 1: Move the directory**

```bash
mv prisma apps/api/prisma
```

**Step 2: Remove seed script from root `package.json`**

Delete this from root `package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

**Step 3: Verify seed.ts imports**

`apps/api/prisma/seed.ts` imports `@/lib/db` — after Task 3 this resolves to `apps/api/src/lib/db.ts`. No change needed in seed.ts itself.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: move prisma to apps/api"
```

---

## Task 3: Copy `src/lib/` and `src/auth.ts` to `apps/api/src/`

**Files:**
- Create: `apps/api/src/lib/` (copy of all root `src/lib/` files)
- Create: `apps/api/src/auth.ts` (copy of root `src/auth.ts`)

**Step 1: Copy all lib files**

```bash
cp -r src/lib apps/api/src/lib
cp src/auth.ts apps/api/src/auth.ts
```

The API app gets the complete `src/lib/` including DB-specific libs. The `@/lib/` alias in `apps/api/tsconfig.json` resolves to `apps/api/src/lib/`, so all imports work without modification.

**Step 2: Verify key import in `apps/api/src/auth.ts`**

The file imports `import { db } from "@/lib/db"` — this now resolves to `apps/api/src/lib/db.ts`. ✓

**Step 3: Commit**

```bash
git add apps/api/src/
git commit -m "feat: copy lib and auth to apps/api"
```

---

## Task 4: Copy all API routes to `apps/api/src/app/api/`

**Files:**
- Create: `apps/api/src/app/api/` (copy of all root `src/app/api/` route files)

**Step 1: Copy the entire API directory**

```bash
cp -r src/app/api apps/api/src/app/api
```

All 76 `route.ts` files import from `@/lib/...` and `@/auth` — both resolve correctly in apps/api. No import changes needed.

**Step 2: Verify the NextAuth handler**

`apps/api/src/app/api/auth/[...nextauth]/route.ts` — this should just re-export handlers:
```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```
Verify it looks like this (open the file). If it does, no changes needed.

**Step 3: Commit**

```bash
git add apps/api/src/app/api/
git commit -m "feat: copy API routes to apps/api"
```

---

## Task 5: Add `department` field to admin user GET endpoint

**Files:**
- Modify: `apps/api/src/app/api/admin/users/[id]/route.ts`

**Step 1: Find the `select` block in the GET handler**

The current select omits `department` (the `String?` field). Add it:

```ts
select: {
  id: true, name: true, email: true, employeeNumber: true,
  department: true,          // ← add this line
  contractType: true, isActive: true, startDate: true,
  initialBalance: true, mustChangePassword: true,
  departmentId: true, managerId: true, deputyId: true,
  workingTimeConfig: true,
  roles: { include: { role: { select: { id: true, name: true } } } },
},
```

**Step 2: Commit**

```bash
git add apps/api/src/app/api/admin/users/
git commit -m "fix: include department field in admin user GET response"
```

---

## Task 6: Create `apps/api/Dockerfile`

**Files:**
- Create: `apps/api/Dockerfile`

**Step 1: Write the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache tini openssl
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0 TZ=Europe/Berlin
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
USER nextjs
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD sh -c "npx prisma migrate deploy --schema=prisma/schema.prisma && node server.js"
```

Note: This Dockerfile is run with `context: apps/api` in docker-compose, so paths are relative to `apps/api/`.

**Step 2: Commit**

```bash
git add apps/api/Dockerfile
git commit -m "feat: add Dockerfile for api container"
```

---

## Task 7: Install `apps/api` dependencies

**Step 1: Install**

```bash
cd apps/api && npm install && cd ../..
```

**Step 2: Verify Prisma client generates**

```bash
cd apps/api && npx prisma generate && cd ../..
```

Expected: Prisma Client generated successfully.

**Step 3: Commit lock file**

```bash
git add apps/api/package-lock.json
git commit -m "chore: install apps/api dependencies"
```

---

## Task 8: Rewrite web's `src/auth.ts`

**Files:**
- Modify: `src/auth.ts`

The web container only needs to decode the JWT session cookie. No DB, no providers, no PrismaAdapter.

**Step 1: Replace the entire file content**

```ts
import NextAuth from "next-auth";

export const entraEnabled = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false;
      session.user.permissions = (token.permissions as string[]) ?? [];
      session.user.roleNames = (token.roleNames as string[]) ?? [];
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

The `signIn("credentials", ...)` call from `login-form.tsx` (using `next-auth/react`) posts to `/api/auth/callback/credentials` → this gets proxied to the API container → API handles auth → sets JWT cookie → web reads cookie. ✓

**Step 2: Commit**

```bash
git add src/auth.ts
git commit -m "feat: strip web auth.ts to JWT-decode only"
```

---

## Task 9: Rewrite web's `src/lib/permissions.ts`

**Files:**
- Modify: `src/lib/permissions.ts`

Replace the DB-querying async functions with a synchronous check against `session.user.permissions`.

**Step 1: Replace the entire file**

```ts
import type { Session } from "next-auth";
import type { Resource, Action, Scope } from "@/lib/rbac";

export type { Resource, Action, Scope };

export function checkPermission(
  session: Session,
  resource: Resource,
  action: Action,
  requiredScope?: Scope
): boolean {
  const perms = session.user.permissions ?? [];
  return perms.some((p) => {
    const [r, a, s] = p.split(":") as [Resource, Action, Scope];
    if (r !== resource || a !== action) return false;
    if (!requiredScope) return true;
    if (s === "all") return true;
    if (s === "team" && requiredScope !== "all") return true;
    return s === requiredScope;
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: replace DB-based hasPermission with JWT-based checkPermission"
```

---

## Task 10: Fix `src/app/dashboard/zeitansicht/page.tsx`

**Files:**
- Modify: `src/app/dashboard/zeitansicht/page.tsx`

Replace `hasPermission()` + `db.user.findUnique()` with `checkPermission()` + API fetch.

**Step 1: Replace the file**

```tsx
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ZeitansichtClient } from "./zeitansicht-client";

export default async function ZeitansichtPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { userId } = await searchParams;

  if (!userId || userId === session.user.id) {
    return <ZeitansichtClient impersonatedUser={null} canAdminEdit={false} />;
  }

  const canViewAll = checkPermission(session, "time_entries", "read", "all");
  if (!canViewAll) redirect("/dashboard/zeitansicht");

  const canAdminEdit = checkPermission(session, "time_entries", "write", "all");

  const cookieHeader = (await cookies()).toString();
  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:3001"}/api/admin/users/${userId}`,
    { headers: { Cookie: cookieHeader }, cache: "no-store" }
  );
  if (!res.ok) redirect("/dashboard/zeitansicht");
  const { user: target } = await res.json();

  return (
    <ZeitansichtClient
      impersonatedUser={{
        id: target.id,
        name: target.name,
        employeeNumber: target.employeeNumber,
      }}
      canAdminEdit={canAdminEdit}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/zeitansicht/page.tsx
git commit -m "fix: replace direct DB call in zeitansicht page with API fetch"
```

---

## Task 11: Fix `src/app/dashboard/team/[userId]/page.tsx`

**Files:**
- Modify: `src/app/dashboard/team/[userId]/page.tsx`

**Step 1: Replace the file**

```tsx
import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MemberDetailView } from "@/components/team/member-detail-view";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = checkPermission(session, "time_entries", "read", "team");
  if (!canRead) redirect("/dashboard");

  const { userId } = await params;
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:3001"}/api/admin/users/${userId}`,
    { headers: { Cookie: cookieHeader }, cache: "no-store" }
  );
  if (!res.ok) redirect("/dashboard/team");
  const { user: member } = await res.json();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{member.name}</h1>
        <p className="text-muted-foreground text-sm">
          {member.email}
          {member.department ? ` · ${member.department}` : ""}
        </p>
      </div>
      <MemberDetailView userId={userId} />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/team/
git commit -m "fix: replace direct DB call in team member page with API fetch"
```

---

## Task 12: Create API proxy middleware for web

**Files:**
- Create: `src/middleware.ts`

This proxies all `/api/*` requests to the API container at runtime. Using middleware (not `next.config.ts` rewrites) so `API_URL` is a runtime env var.

**Step 1: Create `src/middleware.ts`**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const apiUrl = process.env.API_URL ?? "http://localhost:3001";
  const target = new URL(
    request.nextUrl.pathname + request.nextUrl.search,
    apiUrl
  );
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: "/api/:path*",
};
```

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add API proxy middleware for web container"
```

---

## Task 13: Remove API code from web

**Files:**
- Delete: `src/app/api/` (all 76 route files)
- Delete: DB-specific libs from `src/lib/`

**Step 1: Delete API routes from web**

```bash
rm -rf src/app/api
```

**Step 2: Delete API-only libs from web**

Keep: `audit-format.tsx`, `contract-types.ts`, `permissions.ts`, `rbac.ts`, `request-types.ts`, `stamp-types.ts`, `utils.ts`

Delete everything else:

```bash
cd src/lib && rm -f audit.ts auth-session.ts auto-manager-role.ts contract-types.ts db.ts \
  email.ts email-templates.ts holidays.ts local-date.ts login-rate-limit.ts \
  mobile-auth.ts month-close.ts notifications.ts password-policy.ts password.ts \
  refresh-tokens.ts settings.ts surcharges.ts team-access.ts working-time.ts && cd ../..
```

Wait — `contract-types.ts` IS needed by web components. Do NOT delete it. Remove it from the rm command above.

Correct delete list:
```bash
cd src/lib && rm -f audit.ts auth-session.ts auto-manager-role.ts db.ts \
  email.ts email-templates.ts holidays.ts local-date.ts login-rate-limit.ts \
  mobile-auth.ts month-close.ts notifications.ts password-policy.ts password.ts \
  refresh-tokens.ts settings.ts surcharges.ts team-access.ts working-time.ts && cd ../..
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: remove API routes and DB libs from web container"
```

---

## Task 14: Remove API-only deps from root `package.json`

**Files:**
- Modify: `package.json`

Remove deps only needed by the API container. Keep everything frontend-related.

**Step 1: Remove these from `dependencies`**

- `@auth/prisma-adapter` (API only)
- `@prisma/adapter-pg` (API only)
- `@prisma/client` (API only)
- `bcryptjs` (API only)
- `jose` (API only — JWT ops are in API)
- `nodemailer` (API only)
- `otpauth` (API only)
- `papaparse` (API only — CSV export is API-only)
- `pg` (API only)
- `web-push` (API only)
- `jspdf` + `jspdf-autotable` (API only — PDF export)

**Remove from `devDependencies`**:
- `@types/bcryptjs`
- `@types/nodemailer`
- `@types/papaparse`
- `@types/web-push`
- `@types/pg`

Also remove:
- `prisma` from devDependencies (API only)

**Step 2: Run `npm install` to update the lock file**

```bash
npm install
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove API-only deps from web package.json"
```

---

## Task 15: Update `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml`

Add the `api` service. Rename the existing `app` service to `web`. The `db` service stays unchanged.

**Step 1: Replace the `app` service with `web` + `api` services**

```yaml
services:
  db:
    # ... unchanged ...

  api:
    build:
      context: apps/api
      dockerfile: Dockerfile
    image: vfl-zeitspiel-api:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-zeitspiel}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-zeitspiel}
      AUTH_SECRET: ${AUTH_SECRET:?set AUTH_SECRET in .env}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?set NEXTAUTH_SECRET in .env}
      NEXTAUTH_URL: ${NEXTAUTH_URL:?set NEXTAUTH_URL in .env}
      CRON_SECRET: ${CRON_SECRET:?set CRON_SECRET in .env}
      TZ: Europe/Berlin
      VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY:-}
      VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY:-}
      VAPID_SUBJECT: ${VAPID_SUBJECT:-}
      SMTP_PASSWORD: ${SMTP_PASSWORD:-}
      AUTH_MICROSOFT_ENTRA_ID_ID: ${AUTH_MICROSOFT_ENTRA_ID_ID:-}
      AUTH_MICROSOFT_ENTRA_ID_SECRET: ${AUTH_MICROSOFT_ENTRA_ID_SECRET:-}
      AUTH_MICROSOFT_ENTRA_ID_ISSUER: ${AUTH_MICROSOFT_ENTRA_ID_ISSUER:-}
      SENTRY_DSN: ${SENTRY_DSN:-}
      NEXT_PUBLIC_SENTRY_DSN: ${NEXT_PUBLIC_SENTRY_DSN:-}
    ports:
      - "${API_PORT:-3001}:3001"
    depends_on:
      db:
        condition: service_healthy
    tmpfs:
      - /tmp

  web:
    build:
      context: .
      dockerfile: Dockerfile
    image: vfl-zeitspiel-web:latest
    restart: unless-stopped
    environment:
      API_URL: http://api:3001
      AUTH_SECRET: ${AUTH_SECRET:?set AUTH_SECRET in .env}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?set NEXTAUTH_SECRET in .env}
      AUTH_MICROSOFT_ENTRA_ID_ID: ${AUTH_MICROSOFT_ENTRA_ID_ID:-}
      AUTH_MICROSOFT_ENTRA_ID_SECRET: ${AUTH_MICROSOFT_ENTRA_ID_SECRET:-}
      AUTH_MICROSOFT_ENTRA_ID_ISSUER: ${AUTH_MICROSOFT_ENTRA_ID_ISSUER:-}
      SENTRY_DSN: ${SENTRY_DSN:-}
      NEXT_PUBLIC_SENTRY_DSN: ${NEXT_PUBLIC_SENTRY_DSN:-}
      TZ: Europe/Berlin
    ports:
      - "${APP_PORT:-3000}:3000"
    depends_on:
      - api
    tmpfs:
      - /tmp

  proxy:
    # ... unchanged, routes all traffic to web container on port 3000 ...

  backup:
    # ... unchanged ...
```

**Step 2: Add `API_PORT` to `.env.example`**

```
API_PORT="3001"
```

**Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: split docker-compose into separate api and web services"
```

---

## Task 16: Update mobile default API port

**Files:**
- Modify: `apps/mobile/lib/api.ts`

**Step 1: Change default port from 3000 to 3001**

Find this line:
```ts
return `http://${host}:3000`;
```
And the two fallback lines:
```ts
return "http://10.0.2.2:3000";
// ...
return "http://localhost:3000";
```

Change all three to port `3001`.

**Step 2: Commit**

```bash
git add apps/mobile/lib/api.ts
git commit -m "fix: mobile default API port 3000 → 3001 (API container)"
```

---

## Task 17: Verify the web build compiles without DB deps

**Step 1: Run the web build**

```bash
npm run build
```

Expected: Build succeeds with no import errors for `@/lib/db`, `@/lib/auth-session`, etc.

If any component still imports a deleted lib, fix the import by removing or replacing it.

**Step 2: Verify the API build**

```bash
cd apps/api && npm run build && cd ../..
```

Expected: Build succeeds.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve any remaining import errors after split"
```

---

## Task 18: Final integration test with docker-compose

**Step 1: Build and start all services**

```bash
docker compose build && docker compose up -d
```

**Step 2: Verify API container is up**

```bash
docker compose logs api --tail=20
```

Expected: `migrate deploy` runs, then `Listening on port 3001`.

**Step 3: Verify web container is up**

```bash
docker compose logs web --tail=20
```

Expected: `Listening on port 3000`.

**Step 4: Test auth flow via web**

Open `http://localhost:3000/login` → log in → should redirect to dashboard.

**Step 5: Test API proxy**

```bash
curl -b <session_cookie> http://localhost:3000/api/dashboard/stats
```

Expected: JSON response (proxied through web → api).

**Step 6: Test mobile (Expo Go)**

Set `EXPO_PUBLIC_API_URL=http://<host-ip>:3001` in `apps/mobile/.env` and start Expo. Login should work.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete API/web container split"
```

---

## Summary of Container Responsibilities

| | `web` (port 3000) | `api` (port 3001) |
|--|--|--|
| **Database** | ❌ no DATABASE_URL | ✅ full Prisma access |
| **Auth** | JWT decode only (no DB) | Full NextAuth + PrismaAdapter |
| **API Routes** | ❌ proxied to api | ✅ all 76 route handlers |
| **Pages** | ✅ dashboard, login, etc. | ❌ none |
| **Mobile target** | ❌ | ✅ direct (port 3001) |
| **Browser target** | ✅ (port 3000) | via web proxy |
