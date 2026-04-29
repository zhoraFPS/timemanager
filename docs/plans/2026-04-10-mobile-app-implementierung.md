# Mobile App MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expo/React Native mobile app for TimeManager — Stempeln, Zeiten, Antraege, Team, Profil with offline support and biometric auth.

**Architecture:** Expo SDK 53, Expo Router, Nativewind, Zustand, communicates with existing Next.js backend REST API.

**Tech Stack:** Expo, TypeScript, Nativewind, Zustand, Axios, expo-secure-store, expo-local-authentication, expo-camera (QR), expo-notifications, expo-haptics, Lottie

---

## Task 1: Backend — Auth Device Endpoints

New API routes for mobile device registration, QR-code pairing, and JWT refresh.

**Files:**
- Create: `prisma/migrations/MANUAL` (schema change via `prisma db push`)
- Modify: `prisma/schema.prisma` — add `DeviceToken` and `Device` models
- Create: `src/app/api/auth/devices/route.ts`
- Create: `src/app/api/auth/device-token/route.ts`
- Create: `src/app/api/auth/device-exchange/route.ts`
- Create: `src/app/api/auth/refresh/route.ts`
- Create: `src/app/api/auth/mobile-login/route.ts`

### Step 1: Add Prisma models

Add to `prisma/schema.prisma`:

```prisma
model Device {
  id        String   @id @default(cuid())
  userId    String
  deviceId  String   @unique
  name      String?
  pushToken String?
  lastUsed  DateTime @default(now())
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model DeviceToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Add to `User` model:
```prisma
devices       Device[]
deviceTokens  DeviceToken[]
```

### Step 2: Run prisma db push

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager
npx prisma db push --accept-data-loss
```

### Step 3: Create mobile login endpoint

Create `src/app/api/auth/mobile-login/route.ts`:

```typescript
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "secret");

async function createTokens(userId: string) {
  const accessToken = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .setIssuedAt()
    .sign(JWT_SECRET);

  const refreshToken = await new SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  return { accessToken, refreshToken };
}

export async function POST(req: NextRequest) {
  const { employeeNumber, password, deviceId, deviceName } = await req.json();

  if (!employeeNumber || !password) {
    return NextResponse.json({ error: "Mitarbeiternummer und Passwort erforderlich" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { employeeNumber },
    select: { id: true, email: true, name: true, passwordHash: true, isActive: true, twoFactorEnabled: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Ungueltige Anmeldedaten" }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Ungueltige Anmeldedaten" }, { status: 401 });
  }

  // Register device if deviceId provided
  if (deviceId) {
    await db.device.upsert({
      where: { deviceId },
      update: { userId: user.id, name: deviceName, lastUsed: new Date() },
      create: { userId: user.id, deviceId, name: deviceName },
    });
  }

  const tokens = await createTokens(user.id);

  return NextResponse.json({
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
```

### Step 4: Create refresh endpoint

Create `src/app/api/auth/refresh/route.ts`:

```typescript
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "secret");

export async function POST(req: NextRequest) {
  const { refreshToken } = await req.json();
  if (!refreshToken) {
    return NextResponse.json({ error: "Refresh token erforderlich" }, { status: 400 });
  }

  try {
    const { payload } = await jwtVerify(refreshToken, JWT_SECRET);
    if (payload.type !== "refresh" || !payload.sub) {
      return NextResponse.json({ error: "Ungueltiger Token" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Benutzer deaktiviert" }, { status: 401 });
    }

    const accessToken = await new SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .setIssuedAt()
      .sign(JWT_SECRET);

    const newRefreshToken = await new SignJWT({ sub: user.id, type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .setIssuedAt()
      .sign(JWT_SECRET);

    return NextResponse.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    return NextResponse.json({ error: "Token abgelaufen" }, { status: 401 });
  }
}
```

### Step 5: Create device registration endpoint

Create `src/app/api/auth/devices/route.ts`:

```typescript
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  const userId = await verifyMobileToken(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceId, pushToken, name } = await req.json();
  if (!deviceId) return NextResponse.json({ error: "deviceId erforderlich" }, { status: 400 });

  const device = await db.device.upsert({
    where: { deviceId },
    update: { pushToken, name, lastUsed: new Date() },
    create: { userId, deviceId, pushToken, name },
  });

  return NextResponse.json(device);
}

export async function DELETE(req: NextRequest) {
  const userId = await verifyMobileToken(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deviceId } = await req.json();
  await db.device.deleteMany({ where: { userId, deviceId } });

  return NextResponse.json({ deleted: true });
}
```

### Step 6: Create mobile auth helper

Create `src/lib/mobile-auth.ts`:

```typescript
import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "secret");

export async function verifyMobileToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}
```

### Step 7: Create QR device-token generation endpoint (admin)

Create `src/app/api/auth/device-token/route.ts`:

```typescript
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "employees", "write");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId erforderlich" }, { status: 400 });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await db.deviceToken.create({
    data: { token, userId, expiresAt },
  });

  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
}
```

### Step 8: Create QR device-exchange endpoint

Create `src/app/api/auth/device-exchange/route.ts`:

```typescript
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "secret");

export async function POST(req: NextRequest) {
  const { token, deviceId, deviceName } = await req.json();
  if (!token || !deviceId) {
    return NextResponse.json({ error: "Token und deviceId erforderlich" }, { status: 400 });
  }

  const deviceToken = await db.deviceToken.findUnique({ where: { token } });
  if (!deviceToken || deviceToken.used || deviceToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token ungueltig oder abgelaufen" }, { status: 401 });
  }

  // Mark token as used
  await db.deviceToken.update({ where: { id: deviceToken.id }, data: { used: true } });

  // Register device
  await db.device.upsert({
    where: { deviceId },
    update: { userId: deviceToken.userId, name: deviceName, lastUsed: new Date() },
    create: { userId: deviceToken.userId, deviceId, name: deviceName },
  });

  const user = await db.user.findUnique({
    where: { id: deviceToken.userId },
    select: { id: true, email: true, name: true },
  });

  const accessToken = await new SignJWT({ sub: deviceToken.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .setIssuedAt()
    .sign(JWT_SECRET);

  const refreshToken = await new SignJWT({ sub: deviceToken.userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  return NextResponse.json({ accessToken, refreshToken, user });
}
```

### Step 9: Add mobile auth middleware to existing endpoints

Create `src/lib/auth-session.ts` — unified session resolver for both web (NextAuth) and mobile (JWT Bearer):

```typescript
import { auth } from "@/auth";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { NextRequest } from "next/server";

export interface SessionUser {
  id: string;
  name?: string;
  email?: string;
}

export async function getSessionUser(req?: NextRequest): Promise<SessionUser | null> {
  // Try mobile JWT first (Bearer token)
  if (req) {
    const userId = await verifyMobileToken(req);
    if (userId) return { id: userId };
  }

  // Fall back to NextAuth session (web)
  const session = await auth();
  if (session?.user?.id) {
    return { id: session.user.id, name: session.user.name ?? undefined, email: session.user.email ?? undefined };
  }

  return null;
}
```

### Step 10: Commit

```bash
git add prisma/schema.prisma src/app/api/auth/mobile-login/ src/app/api/auth/refresh/ src/app/api/auth/devices/ src/app/api/auth/device-token/ src/app/api/auth/device-exchange/ src/lib/mobile-auth.ts src/lib/auth-session.ts
git commit -m "feat: add mobile auth API endpoints (JWT, device registration, QR pairing)"
```

---

## Task 2: Backend — Mobile-Compatible API Middleware

Update existing API routes to accept both NextAuth sessions AND mobile Bearer tokens, so the mobile app can reuse all existing endpoints.

**Files:**
- Modify: `src/app/api/time-entries/route.ts` — use `getSessionUser`
- Modify: `src/app/api/time-entries/active/route.ts` — use `getSessionUser`
- Modify: `src/app/api/time-entries/week/route.ts` — use `getSessionUser`
- Modify: `src/app/api/requests/route.ts` — use `getSessionUser`
- Modify: `src/app/api/team/members/route.ts` — use `getSessionUser`
- Modify: `src/app/api/shifts/route.ts` — use `getSessionUser`
- Modify: `src/app/api/reports/flextime/route.ts` — use `getSessionUser`
- Modify: `src/app/api/auth/me/route.ts` — use `getSessionUser`
- Modify: `src/app/api/admin/projects/route.ts` — GET only needs `getSessionUser`

### Step 1: Update each route

For each route listed above, change the auth pattern from:
```typescript
const session = await auth();
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// uses session.user.id
```

To:
```typescript
import { getSessionUser } from "@/lib/auth-session";

// In handler:
const user = await getSessionUser(req);
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// uses user.id
```

**IMPORTANT:** For routes using `hasPermission(session.user.id, ...)`, replace with `hasPermission(user.id, ...)`. For routes that don't take `req` as parameter (like GET without NextRequest), add `req: NextRequest` parameter.

Routes that need the `req` parameter added to their GET function signature:
- `src/app/api/time-entries/active/route.ts` — `GET()` → `GET(req: NextRequest)`
- `src/app/api/requests/route.ts` — `GET()` → `GET(req: NextRequest)` 
- `src/app/api/team/members/route.ts` — `GET()` → `GET(req: NextRequest)`
- `src/app/api/auth/me/route.ts` — `GET()` → `GET(req: NextRequest)`
- `src/app/api/admin/projects/route.ts` — `GET()` → `GET(req: NextRequest)`

Routes that already have `req: NextRequest`:
- `src/app/api/time-entries/route.ts` (POST)
- `src/app/api/time-entries/week/route.ts` (GET)
- `src/app/api/shifts/route.ts` (GET/POST/DELETE)
- `src/app/api/reports/flextime/route.ts` (GET)

### Step 2: Commit

```bash
git add src/app/api/
git commit -m "feat: add dual auth (NextAuth + JWT Bearer) to API routes for mobile"
```

---

## Task 3: Expo Project Scaffolding

Create the Expo project with all dependencies configured.

**Files:**
- Create: `apps/mobile/` directory with Expo project
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`

### Step 1: Initialize Expo project

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager
mkdir -p apps/mobile
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript
```

### Step 2: Install dependencies

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager/apps/mobile
npx expo install expo-router expo-linking expo-constants expo-status-bar
npx expo install nativewind tailwindcss@^3
npx expo install expo-secure-store expo-local-authentication expo-camera expo-haptics expo-notifications expo-device
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated
npm install zustand axios lottie-react-native
npm install @expo/vector-icons
```

### Step 3: Configure app.json

Replace `apps/mobile/app.json`:

```json
{
  "expo": {
    "name": "TimeManager",
    "slug": "timemanager-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "timemanager",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#09090b"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.timemanager.mobile",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Biometrische Anmeldung fuer schnellen Zugriff",
        "NSCameraUsageDescription": "QR-Code scannen fuer Geraete-Kopplung"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#09090b"
      },
      "package": "com.timemanager.mobile",
      "permissions": ["CAMERA", "USE_BIOMETRIC", "USE_FINGERPRINT", "RECEIVE_BOOT_COMPLETED", "VIBRATE"]
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-local-authentication",
      ["expo-camera", { "cameraPermission": "QR-Code scannen fuer Geraete-Kopplung" }],
      "expo-notifications"
    ]
  }
}
```

### Step 4: Configure Nativewind

Create `apps/mobile/tailwind.config.js`:

```javascript
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#fafafa",
        card: "#1c1c1e",
        "card-foreground": "#fafafa",
        primary: "#3b82f6",
        "primary-foreground": "#fafafa",
        secondary: "#27272a",
        "secondary-foreground": "#fafafa",
        muted: "#27272a",
        "muted-foreground": "#a1a1aa",
        destructive: "#ef4444",
        success: "#22c55e",
        border: "#27272a",
      },
    },
  },
  plugins: [],
};
```

Create `apps/mobile/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 5: Configure Metro + Babel

Create `apps/mobile/metro.config.js`:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

Create `apps/mobile/babel.config.js`:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

### Step 6: Configure tsconfig

Create `apps/mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts", "nativewind-env.d.ts"]
}
```

### Step 7: Create .env

Create `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Step 8: Commit

```bash
git add apps/mobile/
git commit -m "feat: scaffold Expo project with Nativewind, routing, and dependencies"
```

---

## Task 4: Core Library — API Client, Auth Store, Types

Create the shared library code for the mobile app.

**Files:**
- Create: `apps/mobile/lib/types.ts`
- Create: `apps/mobile/lib/api.ts`
- Create: `apps/mobile/lib/auth.ts`
- Create: `apps/mobile/lib/store.ts`
- Create: `apps/mobile/lib/offline-queue.ts`
- Create: `apps/mobile/lib/notifications.ts`

### Step 1: Create types

Create `apps/mobile/lib/types.ts`:

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  employeeNumber?: string;
  department?: string;
  contractType?: string;
  twoFactorEnabled?: boolean;
}

export interface TimeEntry {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
  projectId: string | null;
  project?: Project;
  breakMinutes?: number;
  note?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  color: string | null;
  isActive: boolean;
}

export interface Request {
  id: string;
  userId: string;
  type: "VACATION" | "SICK" | "HOMEOFFICE" | "TIME_CORRECTION" | "OVERTIME_REDUCE" | "SPECIAL_LEAVE";
  dateFrom: string;
  dateTo: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note?: string;
  createdAt: string;
  approvals?: RequestApproval[];
}

export interface RequestApproval {
  id: string;
  approverId: string;
  status: string;
  comment?: string;
  decidedAt: string;
  approver?: { name: string };
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  department?: string;
}

export interface Shift {
  id: string;
  userId: string;
  date: string;
  user: { id: string; name: string };
  template: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    color: string | null;
  };
}

export interface FlexMonth {
  year: number;
  month: number;
  targetMins: number;
  actualMins: number;
  saldoMins: number;
  cumulativeMins: number;
}

export interface FlexData {
  userId: string;
  name: string;
  hoursPerDay: number;
  initialBalanceHours: number;
  months: FlexMonth[];
}

export interface OfflineStamp {
  id: string;
  type: "WORK" | "OUT";
  timestamp: string;
  projectId?: string;
}
```

### Step 2: Create API client

Create `apps/mobile/lib/api.ts`:

```typescript
import axios from "axios";
import { useAuthStore } from "./store";
import type { TimeEntry, Request as AppRequest, TeamMember, Shift, FlexData, Project } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshed = await useAuthStore.getState().refresh();
      if (refreshed) {
        originalRequest.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
        return api(originalRequest);
      }
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// --- API Functions ---

export async function postStamp(type: string = "WORK", projectId?: string): Promise<{ action: string; entry?: TimeEntry }> {
  const { data } = await api.post("/api/time-entries", { type, projectId });
  return data;
}

export async function getActiveEntry(): Promise<TimeEntry | null> {
  const { data } = await api.get("/api/time-entries/active");
  return data.entry || null;
}

export async function getWeekEntries(date: string): Promise<TimeEntry[]> {
  const { data } = await api.get(`/api/time-entries/week?date=${date}`);
  return data.entries;
}

export async function getRequests(): Promise<AppRequest[]> {
  const { data } = await api.get("/api/requests");
  return data.requests;
}

export async function createRequest(body: {
  type: string;
  dateFrom: string;
  dateTo: string;
  note?: string;
}): Promise<AppRequest> {
  const { data } = await api.post("/api/requests", body);
  return data.request;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data } = await api.get("/api/team/members");
  return data.members;
}

export async function getShifts(week: string): Promise<{ weekStart: string; shifts: Shift[] }> {
  const { data } = await api.get(`/api/shifts?week=${week}`);
  return data;
}

export async function getFlextime(months: number = 12): Promise<FlexData> {
  const { data } = await api.get(`/api/reports/flextime?months=${months}`);
  return data;
}

export async function getProjects(): Promise<Project[]> {
  const { data } = await api.get("/api/admin/projects");
  return data;
}

export async function getProfile(): Promise<any> {
  const { data } = await api.get("/api/auth/me");
  return data;
}

export async function loginWithCredentials(employeeNumber: string, password: string, deviceId: string) {
  const { data } = await api.post("/api/auth/mobile-login", { employeeNumber, password, deviceId });
  return data;
}

export async function exchangeDeviceToken(token: string, deviceId: string) {
  const { data } = await api.post("/api/auth/device-exchange", { token, deviceId });
  return data;
}

export async function refreshAccessToken(refreshToken: string) {
  const { data } = await api.post("/api/auth/refresh", { refreshToken });
  return data;
}

export async function registerPushToken(deviceId: string, pushToken: string) {
  await api.post("/api/auth/devices", { deviceId, pushToken });
}
```

### Step 3: Create Zustand stores

Create `apps/mobile/lib/store.ts`:

```typescript
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { refreshAccessToken } from "./api";
import type { User, TimeEntry, Project, FlexData } from "./types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  biometrieEnabled: boolean;
  isAuthenticated: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<boolean>;
  setBiometrie: (enabled: boolean) => Promise<void>;
  setDeviceId: (id: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  deviceId: null,
  biometrieEnabled: false,
  isAuthenticated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  refresh: async () => {
    const rt = get().refreshToken;
    if (!rt) return false;
    try {
      const { accessToken, refreshToken } = await refreshAccessToken(rt);
      await SecureStore.setItemAsync("refreshToken", refreshToken);
      set({ accessToken, refreshToken });
      return true;
    } catch {
      return false;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("user");
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  loadStoredAuth: async () => {
    const rt = await SecureStore.getItemAsync("refreshToken");
    const userStr = await SecureStore.getItemAsync("user");
    const deviceId = await SecureStore.getItemAsync("deviceId");
    const bioEnabled = await SecureStore.getItemAsync("biometrieEnabled");

    if (rt && userStr) {
      const user = JSON.parse(userStr);
      set({ refreshToken: rt, user, deviceId, biometrieEnabled: bioEnabled === "true" });
      // Try to get fresh access token
      try {
        const { accessToken, refreshToken } = await refreshAccessToken(rt);
        await SecureStore.setItemAsync("refreshToken", refreshToken);
        set({ accessToken, refreshToken, isAuthenticated: true });
        return true;
      } catch {
        return false;
      }
    }
    if (deviceId) set({ deviceId });
    return false;
  },

  setBiometrie: async (enabled) => {
    await SecureStore.setItemAsync("biometrieEnabled", enabled ? "true" : "false");
    set({ biometrieEnabled: enabled });
  },

  setDeviceId: async (id) => {
    await SecureStore.setItemAsync("deviceId", id);
    set({ deviceId: id });
  },
}));

interface TimeState {
  currentEntry: TimeEntry | null;
  weekEntries: TimeEntry[];
  projects: Project[];
  flexData: FlexData | null;
  isLoading: boolean;

  setCurrentEntry: (entry: TimeEntry | null) => void;
  setWeekEntries: (entries: TimeEntry[]) => void;
  setProjects: (projects: Project[]) => void;
  setFlexData: (data: FlexData) => void;
  setLoading: (loading: boolean) => void;
}

export const useTimeStore = create<TimeState>((set) => ({
  currentEntry: null,
  weekEntries: [],
  projects: [],
  flexData: null,
  isLoading: false,

  setCurrentEntry: (entry) => set({ currentEntry: entry }),
  setWeekEntries: (entries) => set({ weekEntries: entries }),
  setProjects: (projects) => set({ projects }),
  setFlexData: (data) => set({ flexData: data }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

interface TeamState {
  members: import("./types").TeamMember[];
  shifts: import("./types").Shift[];
  setMembers: (members: import("./types").TeamMember[]) => void;
  setShifts: (shifts: import("./types").Shift[]) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  members: [],
  shifts: [],
  setMembers: (members) => set({ members }),
  setShifts: (shifts) => set({ shifts }),
}));
```

### Step 4: Create offline queue

Create `apps/mobile/lib/offline-queue.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { postStamp } from "./api";
import type { OfflineStamp } from "./types";

const QUEUE_KEY = "offline_stamps";

export async function getQueue(): Promise<OfflineStamp[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addToQueue(stamp: OfflineStamp): Promise<void> {
  const queue = await getQueue();
  queue.push(stamp);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((s) => s.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue();
  let synced = 0;
  let failed = 0;

  for (const stamp of queue) {
    try {
      await postStamp(stamp.type, stamp.projectId);
      await removeFromQueue(stamp.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
```

### Step 5: Create notifications helper

Create `apps/mobile/lib/notifications.ts`:

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { registerPushToken } from "./api";
import { useAuthStore } from "./store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const pushToken = tokenData.data;

  // Register with backend
  const deviceId = useAuthStore.getState().deviceId;
  if (deviceId) {
    try {
      await registerPushToken(deviceId, pushToken);
    } catch {
      // Silent fail — will retry next time
    }
  }

  return pushToken;
}
```

### Step 6: Commit

```bash
git add apps/mobile/lib/
git commit -m "feat: add mobile core library (API client, stores, offline queue, types)"
```

---

## Task 5: App Layout & Navigation

Create the root layout, auth flow, and tab navigation.

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/login.tsx`
- Create: `apps/mobile/app/qr-scan.tsx`
- Create: `apps/mobile/app/biometric.tsx`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`

### Step 1: Create root layout

Create `apps/mobile/app/_layout.tsx`:

```tsx
import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { syncQueue } from "@/lib/offline-queue";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const biometrieEnabled = useAuthStore((s) => s.biometrieEnabled);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const hasAuth = await loadStoredAuth();
      setIsReady(true);
      if (hasAuth && biometrieEnabled) {
        router.replace("/biometric");
      } else if (hasAuth) {
        router.replace("/(tabs)");
      } else {
        router.replace("/login");
      }
    }
    init();
  }, []);

  // Online sync listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        syncQueue();
      }
    });
    return () => unsubscribe();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#09090b" } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="qr-scan" />
        <Stack.Screen name="biometric" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
```

### Step 2: Create login screen

Create `apps/mobile/app/login.tsx`:

```tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/store";
import { loginWithCredentials } from "@/lib/api";
import * as Crypto from "expo-crypto";

export default function LoginScreen() {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDeviceId = useAuthStore((s) => s.setDeviceId);
  const deviceId = useAuthStore((s) => s.deviceId);

  async function handleLogin() {
    if (!employeeNumber.trim() || !password.trim()) {
      Alert.alert("Fehler", "Bitte Mitarbeiternummer und Passwort eingeben");
      return;
    }

    setLoading(true);
    try {
      let did = deviceId;
      if (!did) {
        did = Crypto.randomUUID();
        await setDeviceId(did);
      }

      const result = await loginWithCredentials(employeeNumber.trim(), password, did);
      await setAuth(result.user, result.accessToken, result.refreshToken);
      router.replace("/(tabs)");
    } catch (error: any) {
      const msg = error.response?.data?.error || "Anmeldung fehlgeschlagen";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
      <View className="flex-1 justify-center px-8">
        <Text className="text-3xl font-bold text-foreground text-center mb-2">TimeManager</Text>
        <Text className="text-muted-foreground text-center mb-10">Melden Sie sich an</Text>

        <View className="space-y-4">
          <View>
            <Text className="text-sm text-muted-foreground mb-1.5">Mitarbeiternummer</Text>
            <TextInput
              className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
              value={employeeNumber}
              onChangeText={setEmployeeNumber}
              placeholder="z.B. 1001"
              placeholderTextColor="#71717a"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="mt-4">
            <Text className="text-sm text-muted-foreground mb-1.5">Passwort</Text>
            <TextInput
              className="bg-card border border-border rounded-lg px-4 py-3 text-foreground"
              value={password}
              onChangeText={setPassword}
              placeholder="Passwort"
              placeholderTextColor="#71717a"
              secureTextEntry
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            className="bg-primary rounded-lg py-3.5 mt-6 items-center"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-primary-foreground font-semibold text-base">Anmelden</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4 items-center py-2"
            onPress={() => router.push("/qr-scan")}
          >
            <Text className="text-primary text-sm">Mit QR-Code koppeln</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
```

### Step 3: Create QR scan screen

Create `apps/mobile/app/qr-scan.tsx`:

```tsx
import { useState } from "react";
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/store";
import { exchangeDeviceToken } from "@/lib/api";
import * as Crypto from "expo-crypto";

export default function QRScanScreen() {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDeviceId = useAuthStore((s) => s.setDeviceId);
  const deviceId = useAuthStore((s) => s.deviceId);

  if (!permission) return <View className="flex-1 bg-background" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-foreground text-center mb-4">Kamera-Zugriff wird benoetigt</Text>
        <TouchableOpacity className="bg-primary rounded-lg px-6 py-3" onPress={requestPermission}>
          <Text className="text-primary-foreground font-semibold">Erlauben</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      let did = deviceId;
      if (!did) {
        did = Crypto.randomUUID();
        await setDeviceId(did);
      }

      const result = await exchangeDeviceToken(data, did);
      await setAuth(result.user, result.accessToken, result.refreshToken);
      router.replace("/(tabs)");
    } catch (error: any) {
      const msg = error.response?.data?.error || "QR-Code ungueltig oder abgelaufen";
      Alert.alert("Fehler", msg);
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <CameraView
          className="flex-1"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        <View className="absolute bottom-0 left-0 right-0 bg-background/80 p-6">
          <Text className="text-foreground text-center text-base mb-2">QR-Code scannen</Text>
          <Text className="text-muted-foreground text-center text-sm">
            Lassen Sie sich den QR-Code von Ihrem Teamleiter zeigen
          </Text>
          {loading && <ActivityIndicator className="mt-4" color="#3b82f6" />}
          <TouchableOpacity className="mt-4 items-center py-2" onPress={() => router.back()}>
            <Text className="text-primary">Zurueck zur Anmeldung</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```

### Step 4: Create biometric screen

Create `apps/mobile/app/biometric.tsx`:

```tsx
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/store";

export default function BiometricScreen() {
  const [attempts, setAttempts] = useState(0);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    authenticate();
  }, []);

  async function authenticate() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Anmelden mit Biometrie",
      cancelLabel: "Abbrechen",
      fallbackLabel: "Passwort verwenden",
    });

    if (result.success) {
      router.replace("/(tabs)");
    } else {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= 3) {
        // Fallback to password
        await useAuthStore.getState().logout();
        router.replace("/login");
      }
    }
  }

  return (
    <View className="flex-1 bg-background items-center justify-center px-8">
      <Text className="text-3xl font-bold text-foreground mb-2">TimeManager</Text>
      <Text className="text-muted-foreground text-center mb-10">
        Authentifizieren Sie sich mit Biometrie
      </Text>

      <TouchableOpacity className="bg-primary rounded-lg px-8 py-3.5" onPress={authenticate}>
        <Text className="text-primary-foreground font-semibold text-base">Erneut versuchen</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="mt-4 py-2"
        onPress={async () => {
          await useAuthStore.getState().logout();
          router.replace("/login");
        }}
      >
        <Text className="text-primary text-sm">Mit Passwort anmelden</Text>
      </TouchableOpacity>

      {attempts > 0 && (
        <Text className="text-muted-foreground text-xs mt-4">
          Versuch {attempts}/3 — nach 3 Fehlversuchen wird Passwort benoetigt
        </Text>
      )}
    </View>
  );
}
```

### Step 5: Create tab layout

Create `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";
import { Timer, Calendar, FileText, Users, User } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#09090b",
          borderTopColor: "#27272a",
          height: 85,
          paddingBottom: 30,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#71717a",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Stempeln",
          tabBarIcon: ({ color, size }) => <Timer color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="zeiten"
        options={{
          title: "Zeiten",
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="antraege"
        options={{
          title: "Antraege",
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "Team",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

### Step 6: Commit

```bash
git add apps/mobile/app/
git commit -m "feat: add app layout, auth screens (login, QR, biometric), tab navigation"
```

---

## Task 6: Tab 1 — Stempeln Screen

The main stamping screen with animated button, live timer, project picker, and flextime card.

**Files:**
- Create: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/components/stamp-button.tsx`
- Create: `apps/mobile/components/project-chips.tsx`
- Create: `apps/mobile/components/gleitzeit-card.tsx`
- Create: `apps/mobile/components/offline-badge.tsx`

### Step 1: Create stamp button component

Create `apps/mobile/components/stamp-button.tsx`:

```tsx
import { TouchableOpacity, View, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

interface StampButtonProps {
  isActive: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function StampButton({ isActive, onPress, disabled }: StampButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive]);

  async function handlePress() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        className={`w-36 h-36 rounded-full items-center justify-center ${isActive ? "bg-destructive" : "bg-success"}`}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text className="text-white text-lg font-bold">
          {isActive ? "Ausstempeln" : "Einstempeln"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
```

### Step 2: Create project chips component

Create `apps/mobile/components/project-chips.tsx`:

```tsx
import { ScrollView, TouchableOpacity, View, Text } from "react-native";
import type { Project } from "@/lib/types";

interface ProjectChipsProps {
  projects: Project[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function ProjectChips({ projects, selected, onSelect }: ProjectChipsProps) {
  const active = projects.filter((p) => p.isActive);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
      <TouchableOpacity
        className={`mr-2 px-4 py-2 rounded-full border ${!selected ? "bg-primary border-primary" : "bg-card border-border"}`}
        onPress={() => onSelect(null)}
      >
        <Text className={`text-sm ${!selected ? "text-primary-foreground" : "text-muted-foreground"}`}>
          Kein Projekt
        </Text>
      </TouchableOpacity>

      {active.map((project) => (
        <TouchableOpacity
          key={project.id}
          className={`mr-2 px-4 py-2 rounded-full border flex-row items-center ${
            selected === project.id ? "bg-primary border-primary" : "bg-card border-border"
          }`}
          onPress={() => onSelect(project.id)}
        >
          {project.color && (
            <View className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: project.color }} />
          )}
          <Text className={`text-sm ${selected === project.id ? "text-primary-foreground" : "text-foreground"}`}>
            {project.code}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
```

### Step 3: Create gleitzeit card component

Create `apps/mobile/components/gleitzeit-card.tsx`:

```tsx
import { View, Text } from "react-native";

interface GleitzeitCardProps {
  saldoMinutes: number;
}

export function GleitzeitCard({ saldoMinutes }: GleitzeitCardProps) {
  const hours = Math.floor(Math.abs(saldoMinutes) / 60);
  const mins = Math.abs(saldoMinutes) % 60;
  const isPositive = saldoMinutes >= 0;
  const formatted = `${isPositive ? "+" : "-"}${hours}:${mins.toString().padStart(2, "0")}`;

  return (
    <View className="bg-card border border-border rounded-xl px-5 py-4 mt-6">
      <Text className="text-muted-foreground text-xs mb-1">Gleitzeit-Saldo</Text>
      <Text className={`text-2xl font-bold ${isPositive ? "text-success" : "text-destructive"}`}>
        {formatted} h
      </Text>
    </View>
  );
}
```

### Step 4: Create offline badge component

Create `apps/mobile/components/offline-badge.tsx`:

```tsx
import { View, Text } from "react-native";
import { WifiOff } from "lucide-react-native";

interface OfflineBadgeProps {
  count: number;
}

export function OfflineBadge({ count }: OfflineBadgeProps) {
  if (count === 0) return null;

  return (
    <View className="flex-row items-center bg-destructive/20 border border-destructive/30 rounded-lg px-3 py-2 mt-4">
      <WifiOff size={14} color="#ef4444" />
      <Text className="text-destructive text-xs ml-2">
        {count} Stempel ausstehend
      </Text>
    </View>
  );
}
```

### Step 5: Create stempeln screen

Create `apps/mobile/app/(tabs)/index.tsx`:

```tsx
import { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import { StampButton } from "@/components/stamp-button";
import { ProjectChips } from "@/components/project-chips";
import { GleitzeitCard } from "@/components/gleitzeit-card";
import { OfflineBadge } from "@/components/offline-badge";
import { useTimeStore } from "@/lib/store";
import { getActiveEntry, getProjects, getFlextime, postStamp } from "@/lib/api";
import { addToQueue, getQueueCount, syncQueue } from "@/lib/offline-queue";

export default function StempelnScreen() {
  const { currentEntry, setCurrentEntry, projects, setProjects, flexData, setFlexData } = useTimeStore();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [timer, setTimer] = useState("00:00:00");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [])
  );

  // Live timer
  useEffect(() => {
    if (currentEntry && !currentEntry.clockOut) {
      const tick = () => {
        const start = new Date(currentEntry.clockIn).getTime();
        const diff = Math.floor((Date.now() - start) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setTimer(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      setTimer("00:00:00");
    }
  }, [currentEntry]);

  async function loadData() {
    try {
      const [entry, proj, flex] = await Promise.all([
        getActiveEntry(),
        getProjects(),
        getFlextime(1),
      ]);
      setCurrentEntry(entry);
      setProjects(proj);
      if (flex) setFlexData(flex);
    } catch { /* silent */ }
    setOfflineCount(await getQueueCount());
  }

  async function handleStamp() {
    setLoading(true);
    const isClockOut = !!currentEntry;
    const type = isClockOut ? "OUT" : "WORK";

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      // Offline — queue it
      await addToQueue({
        id: Crypto.randomUUID(),
        type: isClockOut ? "OUT" : "WORK",
        timestamp: new Date().toISOString(),
        projectId: selectedProject ?? undefined,
      });
      setCurrentEntry(isClockOut ? null : { id: "offline", userId: "", clockIn: new Date().toISOString(), clockOut: null, type: "WORK", projectId: selectedProject });
      setOfflineCount(await getQueueCount());
      setLoading(false);
      return;
    }

    try {
      await postStamp(type, selectedProject ?? undefined);
      const entry = await getActiveEntry();
      setCurrentEntry(entry);
    } catch (error: any) {
      const msg = error.response?.data?.error || "Stempeln fehlgeschlagen";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  }

  const isActive = !!currentEntry && !currentEntry.clockOut;
  const currentSaldo = flexData?.months?.[flexData.months.length - 1]?.cumulativeMins ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        {/* Timer */}
        <Text className="text-5xl font-mono font-bold text-foreground mb-8">{timer}</Text>

        {/* Stamp Button */}
        <StampButton isActive={isActive} onPress={handleStamp} disabled={loading} />

        {/* Project Picker */}
        {!isActive && (
          <ProjectChips projects={projects} selected={selectedProject} onSelect={setSelectedProject} />
        )}

        {/* Gleitzeit */}
        <GleitzeitCard saldoMinutes={currentSaldo} />

        {/* Offline Badge */}
        <OfflineBadge count={offlineCount} />
      </View>
    </SafeAreaView>
  );
}
```

### Step 6: Commit

```bash
git add apps/mobile/app/\(tabs\)/index.tsx apps/mobile/components/
git commit -m "feat: add Stempeln screen with animated button, timer, project chips, offline"
```

---

## Task 7: Tab 2 — Zeiten Screen

Weekly time entry view with swipe navigation, day cards, and week summary.

**Files:**
- Create: `apps/mobile/app/(tabs)/zeiten.tsx`
- Create: `apps/mobile/components/time-entry-card.tsx`
- Create: `apps/mobile/components/week-summary.tsx`

### Step 1: Create time entry card

Create `apps/mobile/components/time-entry-card.tsx`:

```tsx
import { View, Text, TouchableOpacity } from "react-native";
import type { TimeEntry } from "@/lib/types";

interface TimeEntryCardProps {
  date: string;
  entries: TimeEntry[];
  targetHours: number;
  onPress?: () => void;
}

export function TimeEntryCard({ date, entries, targetHours, onPress }: TimeEntryCardProps) {
  const d = new Date(date);
  const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const dayName = dayNames[d.getDay()];
  const dayNum = d.getDate();
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;

  const totalMins = entries.reduce((sum, e) => {
    if (!e.clockOut) return sum;
    return sum + (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / 60000;
  }, 0);
  const actualHours = totalMins / 60;
  const progress = targetHours > 0 ? Math.min(actualHours / targetHours, 1) : 0;

  const formatTime = (iso: string) => {
    const t = new Date(iso);
    return `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <TouchableOpacity
      className={`bg-card border border-border rounded-xl px-4 py-3 mb-2 ${isWeekend ? "opacity-50" : ""}`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Text className="text-muted-foreground text-xs w-6">{dayName}</Text>
          <Text className="text-foreground font-semibold text-base ml-2">{dayNum}.</Text>
        </View>
        <Text className="text-foreground text-sm font-medium">
          {actualHours.toFixed(1)}h / {targetHours}h
        </Text>
      </View>

      {/* Progress bar */}
      <View className="h-1.5 bg-secondary rounded-full mb-2">
        <View
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${progress * 100}%` }}
        />
      </View>

      {/* Entries */}
      {entries.map((entry) => (
        <View key={entry.id} className="flex-row items-center mt-1">
          <Text className="text-muted-foreground text-xs">
            {formatTime(entry.clockIn)} – {entry.clockOut ? formatTime(entry.clockOut) : "laufend"}
          </Text>
          {entry.project && (
            <View className="ml-2 px-2 py-0.5 rounded" style={{ backgroundColor: (entry.project.color || "#3b82f6") + "20" }}>
              <Text className="text-xs" style={{ color: entry.project.color || "#3b82f6" }}>{entry.project.code}</Text>
            </View>
          )}
        </View>
      ))}

      {entries.length === 0 && !isWeekend && (
        <Text className="text-muted-foreground text-xs">Keine Eintraege</Text>
      )}
    </TouchableOpacity>
  );
}
```

### Step 2: Create week summary

Create `apps/mobile/components/week-summary.tsx`:

```tsx
import { View, Text } from "react-native";

interface WeekSummaryProps {
  actualHours: number;
  targetHours: number;
}

export function WeekSummary({ actualHours, targetHours }: WeekSummaryProps) {
  const diff = actualHours - targetHours;
  const isPositive = diff >= 0;

  return (
    <View className="flex-row bg-card border border-border rounded-xl px-4 py-3 mb-4">
      <View className="flex-1 items-center">
        <Text className="text-muted-foreground text-xs">Ist</Text>
        <Text className="text-foreground font-bold text-lg">{actualHours.toFixed(1)}h</Text>
      </View>
      <View className="w-px bg-border" />
      <View className="flex-1 items-center">
        <Text className="text-muted-foreground text-xs">Soll</Text>
        <Text className="text-foreground font-bold text-lg">{targetHours.toFixed(1)}h</Text>
      </View>
      <View className="w-px bg-border" />
      <View className="flex-1 items-center">
        <Text className="text-muted-foreground text-xs">Differenz</Text>
        <Text className={`font-bold text-lg ${isPositive ? "text-success" : "text-destructive"}`}>
          {isPositive ? "+" : ""}{diff.toFixed(1)}h
        </Text>
      </View>
    </View>
  );
}
```

### Step 3: Create zeiten screen

Create `apps/mobile/app/(tabs)/zeiten.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { startOfWeek, endOfWeek, addWeeks, format, eachDayOfInterval } from "date-fns";
import { de } from "date-fns/locale";
import { TimeEntryCard } from "@/components/time-entry-card";
import { WeekSummary } from "@/components/week-summary";
import { getWeekEntries } from "@/lib/api";
import type { TimeEntry } from "@/lib/types";

export default function ZeitenScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });

  useFocusEffect(
    useCallback(() => {
      loadWeek();
    }, [weekOffset])
  );

  async function loadWeek() {
    try {
      const data = await getWeekEntries(currentWeekStart.toISOString());
      setEntries(data);
    } catch { /* silent */ }
  }

  const entriesByDay = days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayEntries = entries.filter((e) => format(new Date(e.clockIn), "yyyy-MM-dd") === dayStr);
    return { date: day.toISOString(), entries: dayEntries };
  });

  const totalActual = entries.reduce((sum, e) => {
    if (!e.clockOut) return sum;
    return sum + (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / 3600000;
  }, 0);

  // 8h per working day (Mon-Fri)
  const workingDays = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6).length;
  const totalTarget = workingDays * 8;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Week Navigation */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <TouchableOpacity onPress={() => setWeekOffset((o) => o - 1)} className="p-2">
          <ChevronLeft size={20} color="#a1a1aa" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-foreground font-semibold">
            {format(currentWeekStart, "d. MMM", { locale: de })} – {format(currentWeekEnd, "d. MMM yyyy", { locale: de })}
          </Text>
          {weekOffset === 0 && <Text className="text-primary text-xs">Aktuelle Woche</Text>}
        </View>
        <TouchableOpacity onPress={() => setWeekOffset((o) => o + 1)} className="p-2">
          <ChevronRight size={20} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View className="px-6">
        <WeekSummary actualHours={totalActual} targetHours={totalTarget} />
      </View>

      {/* Day Cards */}
      <ScrollView className="flex-1 px-6">
        {entriesByDay.map(({ date, entries: dayEntries }) => (
          <TimeEntryCard
            key={date}
            date={date}
            entries={dayEntries}
            targetHours={new Date(date).getDay() !== 0 && new Date(date).getDay() !== 6 ? 8 : 0}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
```

### Step 4: Commit

```bash
git add apps/mobile/app/\(tabs\)/zeiten.tsx apps/mobile/components/time-entry-card.tsx apps/mobile/components/week-summary.tsx
git commit -m "feat: add Zeiten screen with weekly view, day cards, and summary"
```

---

## Task 8: Tab 3 — Antraege Screen

Request list with status badges and create-request form.

**Files:**
- Create: `apps/mobile/app/(tabs)/antraege/index.tsx`
- Create: `apps/mobile/app/(tabs)/antraege/neu.tsx`
- Create: `apps/mobile/app/(tabs)/antraege/_layout.tsx`
- Create: `apps/mobile/components/request-card.tsx`
- Create: `apps/mobile/components/request-form.tsx`

### Step 1: Create antraege stack layout

Create `apps/mobile/app/(tabs)/antraege/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function AntraegeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#09090b" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="neu" options={{ presentation: "modal" }} />
    </Stack>
  );
}
```

### Step 2: Create request card

Create `apps/mobile/components/request-card.tsx`:

```tsx
import { View, Text } from "react-native";
import { Calendar, Thermometer, Home, Clock } from "lucide-react-native";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { Request } from "@/lib/types";

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Calendar; color: string }> = {
  VACATION: { label: "Urlaub", icon: Calendar, color: "#3b82f6" },
  SICK: { label: "Krank", icon: Thermometer, color: "#ef4444" },
  HOMEOFFICE: { label: "Homeoffice", icon: Home, color: "#8b5cf6" },
  TIME_CORRECTION: { label: "Korrektur", icon: Clock, color: "#f59e0b" },
  OVERTIME_REDUCE: { label: "Ueberstunden", icon: Clock, color: "#22c55e" },
  SPECIAL_LEAVE: { label: "Sonderurlaub", icon: Calendar, color: "#06b6d4" },
};

const STATUS_CONFIG: Record<string, { label: string; bgClass: string; textClass: string }> = {
  PENDING: { label: "Offen", bgClass: "bg-yellow-500/20", textClass: "text-yellow-500" },
  APPROVED: { label: "Genehmigt", bgClass: "bg-success/20", textClass: "text-success" },
  REJECTED: { label: "Abgelehnt", bgClass: "bg-destructive/20", textClass: "text-destructive" },
};

export function RequestCard({ request }: { request: Request }) {
  const typeConf = TYPE_CONFIG[request.type] || TYPE_CONFIG.VACATION;
  const statusConf = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING;
  const Icon = typeConf.icon;

  return (
    <View className="bg-card border border-border rounded-xl px-4 py-3 mb-2">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Icon size={16} color={typeConf.color} />
          <Text className="text-foreground font-medium ml-2">{typeConf.label}</Text>
        </View>
        <View className={`px-2 py-0.5 rounded-full ${statusConf.bgClass}`}>
          <Text className={`text-xs font-medium ${statusConf.textClass}`}>{statusConf.label}</Text>
        </View>
      </View>
      <Text className="text-muted-foreground text-xs">
        {format(new Date(request.dateFrom), "d. MMM", { locale: de })} – {format(new Date(request.dateTo), "d. MMM yyyy", { locale: de })}
      </Text>
      {request.note && (
        <Text className="text-muted-foreground text-xs mt-1" numberOfLines={2}>{request.note}</Text>
      )}
    </View>
  );
}
```

### Step 3: Create request form

Create `apps/mobile/components/request-form.tsx`:

```tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { createRequest } from "@/lib/api";

const TYPES = [
  { value: "VACATION", label: "Urlaub" },
  { value: "SICK", label: "Krank" },
  { value: "HOMEOFFICE", label: "Homeoffice" },
  { value: "TIME_CORRECTION", label: "Korrektur" },
];

interface RequestFormProps {
  onSuccess: () => void;
}

export function RequestForm({ onSuccess }: RequestFormProps) {
  const [type, setType] = useState("VACATION");
  const [dateFrom, setDateFrom] = useState(new Date());
  const [dateTo, setDateTo] = useState(new Date());
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  async function handleSubmit() {
    if (dateTo < dateFrom) {
      Alert.alert("Fehler", "Enddatum muss nach Startdatum liegen");
      return;
    }
    setLoading(true);
    try {
      await createRequest({
        type,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        note: note || undefined,
      });
      Alert.alert("Erfolg", "Antrag wurde erstellt");
      onSuccess();
    } catch (error: any) {
      Alert.alert("Fehler", error.response?.data?.error || "Antrag konnte nicht erstellt werden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="space-y-4">
      {/* Type Selector */}
      <View>
        <Text className="text-sm text-muted-foreground mb-2">Typ</Text>
        <View className="flex-row flex-wrap gap-2">
          {TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              className={`px-4 py-2 rounded-lg border ${type === t.value ? "bg-primary border-primary" : "bg-card border-border"}`}
              onPress={() => setType(t.value)}
            >
              <Text className={`text-sm ${type === t.value ? "text-primary-foreground" : "text-foreground"}`}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Date From */}
      <View className="mt-4">
        <Text className="text-sm text-muted-foreground mb-1.5">Von</Text>
        <TouchableOpacity
          className="bg-card border border-border rounded-lg px-4 py-3"
          onPress={() => setShowFromPicker(true)}
        >
          <Text className="text-foreground">{format(dateFrom, "dd.MM.yyyy")}</Text>
        </TouchableOpacity>
        {showFromPicker && (
          <DateTimePicker
            value={dateFrom}
            mode="date"
            onChange={(_, date) => { setShowFromPicker(Platform.OS === "ios"); if (date) setDateFrom(date); }}
          />
        )}
      </View>

      {/* Date To */}
      <View className="mt-4">
        <Text className="text-sm text-muted-foreground mb-1.5">Bis</Text>
        <TouchableOpacity
          className="bg-card border border-border rounded-lg px-4 py-3"
          onPress={() => setShowToPicker(true)}
        >
          <Text className="text-foreground">{format(dateTo, "dd.MM.yyyy")}</Text>
        </TouchableOpacity>
        {showToPicker && (
          <DateTimePicker
            value={dateTo}
            mode="date"
            onChange={(_, date) => { setShowToPicker(Platform.OS === "ios"); if (date) setDateTo(date); }}
          />
        )}
      </View>

      {/* Note */}
      <View className="mt-4">
        <Text className="text-sm text-muted-foreground mb-1.5">Notiz (optional)</Text>
        <TextInput
          className="bg-card border border-border rounded-lg px-4 py-3 text-foreground min-h-[80px]"
          value={note}
          onChangeText={setNote}
          placeholder="Optionale Notiz..."
          placeholderTextColor="#71717a"
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        className="bg-primary rounded-lg py-3.5 mt-6 items-center"
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-primary-foreground font-semibold text-base">Antrag einreichen</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
```

### Step 4: Create antraege list screen

Create `apps/mobile/app/(tabs)/antraege/index.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { RequestCard } from "@/components/request-card";
import { getRequests } from "@/lib/api";
import type { Request } from "@/lib/types";

export default function AntraegeScreen() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [])
  );

  async function loadRequests() {
    try {
      const data = await getRequests();
      setRequests(data);
    } catch { /* silent */ }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text className="text-xl font-bold text-foreground">Antraege</Text>
        <TouchableOpacity
          className="bg-primary rounded-lg px-4 py-2 flex-row items-center"
          onPress={() => router.push("/antraege/neu")}
        >
          <Plus size={16} color="#fff" />
          <Text className="text-primary-foreground font-medium text-sm ml-1">Neu</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RequestCard request={item} />}
        contentContainerClassName="px-6 pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-muted-foreground">Keine Antraege vorhanden</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
```

### Step 5: Create new request screen

Create `apps/mobile/app/(tabs)/antraege/neu.tsx`:

```tsx
import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { RequestForm } from "@/components/request-form";

export default function NeuAntragScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text className="text-xl font-bold text-foreground">Neuer Antrag</Text>
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <X size={20} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6">
        <RequestForm onSuccess={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

### Step 6: Commit

```bash
git add apps/mobile/app/\(tabs\)/antraege/ apps/mobile/components/request-card.tsx apps/mobile/components/request-form.tsx
git commit -m "feat: add Antraege screen with request list, status badges, and create form"
```

---

## Task 9: Tab 4 — Team Screen

Team status with online indicators and compact shift grid.

**Files:**
- Create: `apps/mobile/app/(tabs)/team.tsx`
- Create: `apps/mobile/components/team-member-card.tsx`
- Create: `apps/mobile/components/shift-grid.tsx`

### Step 1: Create team member card

Create `apps/mobile/components/team-member-card.tsx`:

```tsx
import { View, Text } from "react-native";
import type { TeamMember, TimeEntry } from "@/lib/types";

interface TeamMemberCardProps {
  member: TeamMember;
  activeEntry?: TimeEntry | null;
}

export function TeamMemberCard({ member, activeEntry }: TeamMemberCardProps) {
  const isActive = !!activeEntry && !activeEntry.clockOut;
  const initials = member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <View className="bg-card border border-border rounded-xl px-4 py-3 mb-2 flex-row items-center">
      <View className="w-10 h-10 rounded-full bg-secondary items-center justify-center mr-3">
        <Text className="text-foreground font-semibold text-sm">{initials}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-foreground font-medium">{member.name}</Text>
        {member.department && (
          <Text className="text-muted-foreground text-xs">{member.department}</Text>
        )}
      </View>
      <View className={`w-3 h-3 rounded-full ${isActive ? "bg-success" : "bg-muted"}`} />
    </View>
  );
}
```

### Step 2: Create shift grid

Create `apps/mobile/components/shift-grid.tsx`:

```tsx
import { View, Text, ScrollView } from "react-native";
import { format, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import type { Shift } from "@/lib/types";

interface ShiftGridProps {
  shifts: Shift[];
  weekStart: Date;
}

export function ShiftGrid({ shifts, weekStart }: ShiftGridProps) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  // Group by user
  const userMap = new Map<string, { name: string; shifts: Map<string, Shift> }>();
  for (const shift of shifts) {
    if (!userMap.has(shift.userId)) {
      userMap.set(shift.userId, { name: shift.user.name, shifts: new Map() });
    }
    const dayKey = format(new Date(shift.date), "yyyy-MM-dd");
    userMap.get(shift.userId)!.shifts.set(dayKey, shift);
  }

  if (userMap.size === 0) {
    return (
      <View className="items-center py-6">
        <Text className="text-muted-foreground text-sm">Keine Schichten diese Woche</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {/* Header */}
        <View className="flex-row mb-2">
          <View className="w-24" />
          {days.map((day, i) => (
            <View key={i} className="w-16 items-center">
              <Text className="text-muted-foreground text-xs">{dayNames[i]}</Text>
              <Text className="text-foreground text-xs font-medium">{format(day, "d.")}</Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {Array.from(userMap.entries()).map(([userId, { name, shifts: userShifts }]) => (
          <View key={userId} className="flex-row items-center mb-1">
            <Text className="w-24 text-foreground text-xs" numberOfLines={1}>{name}</Text>
            {days.map((day, i) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const shift = userShifts.get(dayKey);
              return (
                <View key={i} className="w-16 h-8 items-center justify-center mx-0.5">
                  {shift ? (
                    <View
                      className="w-14 h-7 rounded items-center justify-center"
                      style={{ backgroundColor: (shift.template.color || "#3b82f6") + "30" }}
                    >
                      <Text className="text-xs" style={{ color: shift.template.color || "#3b82f6" }}>
                        {shift.template.startTime}
                      </Text>
                    </View>
                  ) : (
                    <View className="w-14 h-7 rounded bg-secondary/30" />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
```

### Step 3: Create team screen

Create `apps/mobile/app/(tabs)/team.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { startOfWeek } from "date-fns";
import { TeamMemberCard } from "@/components/team-member-card";
import { ShiftGrid } from "@/components/shift-grid";
import { getTeamMembers, getShifts } from "@/lib/api";
import { useTeamStore } from "@/lib/store";

export default function TeamScreen() {
  const { members, setMembers, shifts, setShifts } = useTeamStore();
  const [view, setView] = useState<"status" | "shifts">("status");
  const [refreshing, setRefreshing] = useState(false);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const [membersData, shiftsData] = await Promise.all([
        getTeamMembers(),
        getShifts(weekStart.toISOString()),
      ]);
      setMembers(membersData);
      setShifts(shiftsData.shifts);
    } catch { /* silent */ }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4">
        <Text className="text-xl font-bold text-foreground mb-4">Team</Text>

        {/* Toggle */}
        <View className="flex-row bg-card border border-border rounded-lg p-1 mb-4">
          <TouchableOpacity
            className={`flex-1 py-2 rounded-md items-center ${view === "status" ? "bg-primary" : ""}`}
            onPress={() => setView("status")}
          >
            <Text className={`text-sm font-medium ${view === "status" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              Status
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 rounded-md items-center ${view === "shifts" ? "bg-primary" : ""}`}
            onPress={() => setView("shifts")}
          >
            <Text className={`text-sm font-medium ${view === "shifts" ? "text-primary-foreground" : "text-muted-foreground"}`}>
              Schichtplan
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {view === "status" ? (
          members.length > 0 ? (
            members.map((member) => (
              <TeamMemberCard key={member.id} member={member} />
            ))
          ) : (
            <View className="items-center py-10">
              <Text className="text-muted-foreground">Keine Teammitglieder</Text>
            </View>
          )
        ) : (
          <ShiftGrid shifts={shifts} weekStart={weekStart} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

### Step 4: Commit

```bash
git add apps/mobile/app/\(tabs\)/team.tsx apps/mobile/components/team-member-card.tsx apps/mobile/components/shift-grid.tsx
git commit -m "feat: add Team screen with member status cards and shift grid"
```

---

## Task 10: Tab 5 — Profil Screen

User profile with flextime chart, vacation counter, biometric toggle, and logout.

**Files:**
- Create: `apps/mobile/app/(tabs)/profil.tsx`

### Step 1: Create profil screen

Create `apps/mobile/app/(tabs)/profil.tsx`:

```tsx
import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { LogOut, Shield, Bell } from "lucide-react-native";
import { useAuthStore } from "@/lib/store";
import { getProfile, getFlextime } from "@/lib/api";
import { registerForPushNotifications } from "@/lib/notifications";
import type { User, FlexData } from "@/lib/types";

export default function ProfilScreen() {
  const { user, biometrieEnabled, setBiometrie, logout } = useAuthStore();
  const [profile, setProfile] = useState<User | null>(null);
  const [flexData, setFlexData] = useState<FlexData | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const [prof, flex] = await Promise.all([getProfile(), getFlextime(4)]);
      setProfile(prof);
      setFlexData(flex);
    } catch { /* silent */ }
  }

  async function toggleBiometrie(value: boolean) {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert("Nicht verfuegbar", "Biometrie ist auf diesem Geraet nicht eingerichtet");
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Biometrie aktivieren" });
      if (!result.success) return;
    }
    await setBiometrie(value);
  }

  async function togglePush(value: boolean) {
    if (value) {
      const token = await registerForPushNotifications();
      if (!token) {
        Alert.alert("Fehler", "Push-Benachrichtigungen konnten nicht aktiviert werden");
        return;
      }
    }
    setPushEnabled(value);
  }

  async function handleLogout() {
    Alert.alert("Abmelden", "Moechten Sie sich wirklich abmelden?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Abmelden", style: "destructive", onPress: async () => {
        await logout();
        router.replace("/login");
      }},
    ]);
  }

  const initials = (user?.name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const currentSaldo = flexData?.months?.[flexData.months.length - 1]?.cumulativeMins ?? 0;
  const saldoH = Math.floor(Math.abs(currentSaldo) / 60);
  const saldoM = Math.abs(currentSaldo) % 60;
  const saldoFormatted = `${currentSaldo >= 0 ? "+" : "-"}${saldoH}:${saldoM.toString().padStart(2, "0")}`;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6 py-4">
        {/* Header */}
        <View className="items-center mb-6">
          <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center mb-3">
            <Text className="text-foreground font-bold text-2xl">{initials}</Text>
          </View>
          <Text className="text-foreground font-bold text-xl">{user?.name}</Text>
          <Text className="text-muted-foreground text-sm">{profile?.email}</Text>
          {profile?.department && (
            <Text className="text-muted-foreground text-xs mt-1">{profile.department}</Text>
          )}
        </View>

        {/* Gleitzeit Card */}
        <View className="bg-card border border-border rounded-xl p-4 mb-4">
          <Text className="text-muted-foreground text-xs mb-2">Gleitzeit-Saldo</Text>
          <Text className={`text-3xl font-bold ${currentSaldo >= 0 ? "text-success" : "text-destructive"}`}>
            {saldoFormatted} h
          </Text>
          {/* Mini sparkline representation */}
          {flexData && flexData.months.length > 1 && (
            <View className="flex-row items-end mt-3 h-8 gap-1">
              {flexData.months.map((m, i) => {
                const maxAbs = Math.max(...flexData.months.map((mm) => Math.abs(mm.saldoMins)), 1);
                const height = Math.max(4, (Math.abs(m.saldoMins) / maxAbs) * 32);
                return (
                  <View
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height,
                      backgroundColor: m.saldoMins >= 0 ? "#22c55e" : "#ef4444",
                      opacity: i === flexData.months.length - 1 ? 1 : 0.5,
                    }}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* Settings */}
        <View className="bg-card border border-border rounded-xl mb-4">
          <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-border">
            <View className="flex-row items-center">
              <Shield size={18} color="#a1a1aa" />
              <Text className="text-foreground ml-3">Biometrie</Text>
            </View>
            <Switch
              value={biometrieEnabled}
              onValueChange={toggleBiometrie}
              trackColor={{ false: "#27272a", true: "#3b82f6" }}
              thumbColor="#fff"
            />
          </View>
          <View className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-row items-center">
              <Bell size={18} color="#a1a1aa" />
              <Text className="text-foreground ml-3">Push-Benachrichtigungen</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={togglePush}
              trackColor={{ false: "#27272a", true: "#3b82f6" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          className="bg-card border border-destructive/30 rounded-xl px-4 py-3.5 flex-row items-center justify-center"
          onPress={handleLogout}
        >
          <LogOut size={18} color="#ef4444" />
          <Text className="text-destructive font-medium ml-2">Abmelden</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
```

### Step 2: Commit

```bash
git add apps/mobile/app/\(tabs\)/profil.tsx
git commit -m "feat: add Profil screen with flextime, biometric toggle, and logout"
```

---

## Task 11: Install NetInfo + DateTimePicker + Crypto Dependencies

Missing dependencies that were referenced in the code.

**Files:**
- Modify: `apps/mobile/package.json`

### Step 1: Install missing dependencies

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager/apps/mobile
npx expo install @react-native-community/netinfo @react-native-community/datetimepicker expo-crypto
npm install date-fns lucide-react-native react-native-svg
```

### Step 2: Commit

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "feat: install remaining mobile dependencies (netinfo, datetimepicker, crypto)"
```

---

## Task 12: EAS Build Configuration + Assets

Configure EAS build profiles and placeholder assets.

**Files:**
- Create: `apps/mobile/eas.json`
- Create: `apps/mobile/assets/icon.png` (placeholder)
- Create: `apps/mobile/assets/splash.png` (placeholder)
- Create: `apps/mobile/assets/adaptive-icon.png` (placeholder)

### Step 1: Create eas.json

Create `apps/mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 13.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 2: Create placeholder assets

Generate simple colored PNGs (1024x1024 for icon, 1284x2778 for splash) as placeholders. The actual branded assets will be created later.

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager/apps/mobile
mkdir -p assets
# Create minimal placeholder files (will be replaced with actual branding)
```

### Step 3: Commit

```bash
git add apps/mobile/eas.json apps/mobile/assets/
git commit -m "feat: add EAS build configuration and placeholder assets"
```

---

## Task 13: Type Check & Verify

Run type checking on both the backend changes and the mobile app.

### Step 1: Type check backend

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager
npx tsc --noEmit
```

Fix any TypeScript errors.

### Step 2: Install jose dependency for backend

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager
npm install jose
```

### Step 3: Verify mobile app compiles

```bash
cd C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager/apps/mobile
npx tsc --noEmit
```

Fix any TypeScript errors.

### Step 4: Commit fixes

```bash
git add .
git commit -m "fix: resolve type errors in backend and mobile app"
```
