# Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dashboard Cockpit, Zeitansicht 3-Modi, Fußballverein-Stempeltypen, Zeitkorrektur, bidirektionales Notification-System, Manager/HR Teamansicht

**Architecture:** Erweiterung des bestehenden Next.js 16 / Prisma 7 / Auth.js v5 Systems. Neue DB-Modelle via Migration, neue API-Routes, neue Client-Komponenten mit shadcn/ui (dark mode). Polling für Notifications (30s), Web Push API für Browser-Push, Nodemailer für E-Mail.

**Tech Stack:** Next.js 16, Prisma 7, shadcn/ui, date-fns, web-push, nodemailer, Vitest

---

## Kontext für alle Tasks

- Arbeitsverzeichnis: `C:/Users/faber/Desktop/Code/fivdm/fivemscripts/timemanager`
- Prisma 7: adapter-basierter Client in `src/lib/db.ts` (PrismaPg)
- Auth.js v5: `auth()` aus `@/auth`, Session hat `session.user.id`
- shadcn/ui Komponenten in `src/components/ui/`
- Bestehende Stempeluhr: `src/components/dashboard/clock-widget.tsx`
- Bestehende Zeitansicht: `src/app/dashboard/zeitansicht/page.tsx`

---

## Task 1: DB-Migration — Neue Modelle & TimeEntry-Erweiterung

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev --name phase2`

**Step 1: Schema erweitern**

Füge folgende Modelle zu `prisma/schema.prisma` hinzu (nach dem letzten Modell):

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  senderId  String?
  type      String   // SYSTEM | MESSAGE | APPROVAL | CORRECTION
  title     String
  body      String
  link      String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation("UserNotifications", fields: [userId], references: [id])
  sender    User?    @relation("SenderNotifications", fields: [senderId], references: [id])
}

model NotificationPreference {
  userId             String  @id
  emailEnabled       Boolean @default(true)
  browserPushEnabled Boolean @default(false)
  pushSubscription   Json?
  user               User    @relation(fields: [userId], references: [id])
}

model SystemConfig {
  key   String @id
  value String
}

model TimeEntryEditRequest {
  id          String    @id @default(cuid())
  timeEntryId String
  userId      String
  newType     String?
  newClockIn  DateTime?
  newClockOut DateTime?
  reason      String
  status      String    @default("PENDING")
  reviewedBy  String?
  reviewedAt  DateTime?
  createdAt   DateTime  @default(now())
  timeEntry   TimeEntry @relation(fields: [timeEntryId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
}
```

Erweitere das `User` Model um die neuen Relations (nach `approvals`):
```prisma
  notificationsReceived Notification[]        @relation("UserNotifications")
  notificationsSent     Notification[]        @relation("SenderNotifications")
  notificationPreference NotificationPreference?
  timeEntryEditRequests TimeEntryEditRequest[]
```

Erweitere das `TimeEntry` Model um die neue Relation:
```prisma
  editRequests TimeEntryEditRequest[]
```

**Step 2: Migration ausführen**

```bash
docker-compose up -d db
npx prisma migrate dev --name phase2
```

Expected: Migration erfolgreich, neue Tabellen angelegt.

**Step 3: Seed — SystemConfig hinzufügen**

Füge am Ende von `prisma/seed.ts` vor `main().$catch` hinzu:

```ts
await db.systemConfig.upsert({
  where: { key: "maxCorrectionDays" },
  update: {},
  create: { key: "maxCorrectionDays", value: "7" },
});

await db.systemConfig.upsert({
  where: { key: "smtpHost" },
  update: {},
  create: { key: "smtpHost", value: "" },
});

await db.systemConfig.upsert({
  where: { key: "smtpPort" },
  update: {},
  create: { key: "smtpPort", value: "587" },
});

await db.systemConfig.upsert({
  where: { key: "smtpUser" },
  update: {},
  create: { key: "smtpUser", value: "" },
});

await db.systemConfig.upsert({
  where: { key: "smtpFrom" },
  update: {},
  create: { key: "smtpFrom", value: "zeiterfassung@firma.de" },
});
```

```bash
npx prisma db seed
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Phase 2 DB models — Notification, SystemConfig, TimeEntryEditRequest"
```

---

## Task 2: Stempeltypen-Konstanten & Stempeluhr neu

**Files:**
- Create: `src/lib/stamp-types.ts`
- Modify: `src/app/api/time-entries/route.ts`
- Modify: `src/components/dashboard/clock-widget.tsx`

**Step 1: `src/lib/stamp-types.ts` erstellen**

```ts
export const STAMP_IN_TYPES = {
  WORK:          { label: "Kommen",               color: "bg-blue-600",   textColor: "text-blue-400" },
  MOBILE_WORK:   { label: "Mobiles Arbeiten",      color: "bg-purple-600", textColor: "text-purple-400" },
  HOME_GAME:     { label: "Heimspiel",             color: "bg-green-600",  textColor: "text-green-400" },
  AWAY_GAME:     { label: "Auswärtsspiel",         color: "bg-orange-600", textColor: "text-orange-400" },
  BUSINESS_TRIP: { label: "Dienstreise",           color: "bg-yellow-600", textColor: "text-yellow-400" },
  TRAINING:      { label: "Fortbildung",           color: "bg-cyan-600",   textColor: "text-cyan-400" },
  VOLUNTEERING:  { label: "Corp. Volunteering",    color: "bg-pink-600",   textColor: "text-pink-400" },
} as const;

export type StampInType = keyof typeof STAMP_IN_TYPES;

export const STAMP_OUT_TYPE = "LEAVE";

export const ALL_STAMP_TYPES = [...Object.keys(STAMP_IN_TYPES), STAMP_OUT_TYPE] as const;
```

**Step 2: API-Route für Stempeln erweitern**

Ersetze `src/app/api/time-entries/route.ts` komplett:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { STAMP_IN_TYPES, STAMP_OUT_TYPE } from "@/lib/stamp-types";

const VALID_TYPES = [...Object.keys(STAMP_IN_TYPES), STAMP_OUT_TYPE];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type: string = body.type ?? "WORK";

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Ungültiger Stempeltyp" }, { status: 400 });
  }

  const userId = session.user.id;
  const now = new Date();

  // Aktiven Eintrag schließen (falls vorhanden)
  const active = await db.timeEntry.findFirst({
    where: { userId, clockOut: null },
  });

  if (active) {
    await db.timeEntry.update({
      where: { id: active.id },
      data: { clockOut: now },
    });
  }

  // Bei LEAVE (Gehen) nur ausstempeln, keinen neuen Eintrag
  if (type === STAMP_OUT_TYPE) {
    return NextResponse.json({ action: "clockOut" });
  }

  // Neuen Eintrag mit neuem Typ öffnen
  const entry = await db.timeEntry.create({
    data: { userId, clockIn: now, type },
  });

  return NextResponse.json({ action: "clockIn", entry });
}
```

**Step 3: Stempeluhr-Widget neu**

Ersetze `src/components/dashboard/clock-widget.tsx` komplett:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { de } from "date-fns/locale";
import { STAMP_IN_TYPES, STAMP_OUT_TYPE, type StampInType } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
}

export function ClockWidget() {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchActive = useCallback(async () => {
    const res = await fetch("/api/time-entries/active");
    const data = await res.json();
    setActiveEntry(data.entry ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchActive(); }, [fetchActive]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleStamp(type: string) {
    setActing(type);
    const res = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (res.ok) await fetchActive();
    setActing(null);
  }

  const elapsed = activeEntry
    ? differenceInSeconds(now, new Date(activeEntry.clockIn))
    : 0;
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const elapsedStr = `${hh}:${mm}:${ss}`;

  const activeType = activeEntry?.type as StampInType | undefined;
  const activeInfo = activeType ? STAMP_IN_TYPES[activeType] : null;

  return (
    <Card className="col-span-2">
      <CardContent className="p-6 space-y-4">
        {/* Uhr */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-mono">
            {format(now, "EEEE, dd. MMMM yyyy · HH:mm:ss", { locale: de })}
          </span>
        </div>

        {/* Status */}
        {!loading && (
          <div className="flex items-center gap-3">
            {activeInfo ? (
              <>
                <span className={cn("w-2 h-2 rounded-full animate-pulse", activeInfo.color)} />
                <Badge className={cn("text-sm", activeInfo.color)}>
                  {activeInfo.label}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  seit {format(new Date(activeEntry!.clockIn), "HH:mm")} Uhr
                </span>
                <span className="font-mono font-bold ml-auto text-lg tabular-nums">
                  {elapsedStr}
                </span>
              </>
            ) : (
              <Badge variant="secondary">Ausgestempelt</Badge>
            )}
          </div>
        )}

        {/* Einstempel-Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(STAMP_IN_TYPES) as [StampInType, typeof STAMP_IN_TYPES[StampInType]][]).map(([key, info]) => (
            <Button
              key={key}
              size="sm"
              variant={activeEntry?.type === key ? "default" : "outline"}
              onClick={() => handleStamp(key)}
              disabled={!!acting}
              className={cn(
                "text-xs h-9",
                activeEntry?.type === key && info.color
              )}
            >
              {acting === key ? "..." : info.label}
            </Button>
          ))}
        </div>

        {/* Gehen-Button */}
        <Button
          variant="destructive"
          className="w-full h-10"
          onClick={() => handleStamp(STAMP_OUT_TYPE)}
          disabled={!activeEntry || !!acting}
        >
          {acting === STAMP_OUT_TYPE ? "..." : "Gehen"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Build prüfen**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add football club stamp types with multi-type clock widget"
```

---

## Task 3: Zeitansicht — 3 Modi (Monat, Woche, Tabelle)

**Files:**
- Create: `src/components/time/view-toggle.tsx`
- Create: `src/components/time/month-calendar.tsx`
- Create: `src/components/time/week-view.tsx`
- Create: `src/components/time/table-view.tsx`
- Modify: `src/app/dashboard/zeitansicht/page.tsx`
- Modify: `src/app/api/time-entries/month/route.ts`

**Step 1: API — Wochendaten**

Erstelle `src/app/api/time-entries/week/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { startOfWeek, endOfWeek } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") ?? new Date().toISOString();
  const date = new Date(dateStr);

  const entries = await db.timeEntry.findMany({
    where: {
      userId: session.user.id,
      clockIn: {
        gte: startOfWeek(date, { weekStartsOn: 1 }),
        lte: endOfWeek(date, { weekStartsOn: 1 }),
      },
    },
    orderBy: { clockIn: "asc" },
  });

  return NextResponse.json({ entries });
}
```

**Step 2: `src/components/time/view-toggle.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { LayoutGrid, Columns, Table } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "month" | "week" | "table";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border border-border rounded-md overflow-hidden">
      {(["month", "week", "table"] as ViewMode[]).map((m) => {
        const Icon = m === "month" ? LayoutGrid : m === "week" ? Columns : Table;
        const label = m === "month" ? "Monat" : m === "week" ? "Woche" : "Tabelle";
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 3: `src/components/time/month-calendar.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { format, getDaysInMonth, getDay, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string; clockIn: string; clockOut: string | null; type: string;
}

interface Props {
  year: number; month: number;
}

const DAY_COLORS: Record<string, string> = {
  ok: "bg-green-900/40 text-green-300",
  low: "bg-yellow-900/40 text-yellow-300",
  missing: "bg-red-900/30 text-red-400",
  weekend: "bg-muted/20 text-muted-foreground",
};

export function MonthCalendar({ year, month }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    fetch(`/api/time-entries/month?year=${year}&month=${month}`)
      .then(r => r.json()).then(d => setEntries(d.entries ?? []));
  }, [year, month]);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const firstDay = (getDay(startOfMonth(new Date(year, month - 1))) + 6) % 7; // Mo=0

  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  function getHoursForDay(day: number) {
    const dayEntries = entries.filter(e => new Date(e.clockIn).getDate() === day);
    return dayEntries.reduce((sum, e) => {
      if (!e.clockOut) return sum;
      return sum + (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / 3600000;
    }, 0);
  }

  function getDayColor(day: number) {
    const date = new Date(year, month - 1, day);
    const isWeekend = [0, 6].includes(getDay(date));
    if (isWeekend) return DAY_COLORS.weekend;
    const hours = getHoursForDay(day);
    if (hours >= 7.5) return DAY_COLORS.ok;
    if (hours > 0) return DAY_COLORS.low;
    return DAY_COLORS.missing;
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-xs text-muted-foreground text-center py-1 font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const hours = getHoursForDay(day);
          const color = getDayColor(day);
          return (
            <div key={day} className={cn("rounded-md p-2 min-h-[64px] text-sm", color)}>
              <div className="font-medium">{day}</div>
              {hours > 0 && (
                <div className="text-xs mt-1 font-mono">
                  {Math.floor(hours)}:{String(Math.round((hours % 1) * 60)).padStart(2, "0")}h
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 4: `src/components/time/week-view.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, differenceInMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string; clockIn: string; clockOut: string | null; type: string;
}

interface Props { date: Date; }

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00

export function WeekView({ date }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    fetch(`/api/time-entries/week?date=${date.toISOString()}`)
      .then(r => r.json()).then(d => setEntries(d.entries ?? []));
  }, [date]);

  function getEntriesForDay(day: Date) {
    return entries.filter(e =>
      new Date(e.clockIn).toDateString() === day.toDateString()
    );
  }

  function toPercent(dt: Date) {
    const mins = dt.getHours() * 60 + dt.getMinutes();
    return ((mins - 7 * 60) / (13 * 60)) * 100;
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[700px]" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        {/* Header */}
        <div />
        {days.map(d => (
          <div key={d.toISOString()} className="text-center text-sm pb-2 border-b border-border">
            <div className="font-medium">{format(d, "EEE", { locale: de })}</div>
            <div className="text-muted-foreground text-xs">{format(d, "dd.MM.")}</div>
          </div>
        ))}

        {/* Time grid */}
        <div className="relative" style={{ height: `${HOURS.length * 56}px` }}>
          {HOURS.map(h => (
            <div key={h} className="absolute w-full text-xs text-muted-foreground text-right pr-2"
              style={{ top: `${((h - 7) / 13) * 100}%` }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map(day => {
          const dayEntries = getEntriesForDay(day);
          return (
            <div key={day.toISOString()} className="relative border-l border-border"
              style={{ height: `${HOURS.length * 56}px` }}>
              {HOURS.map(h => (
                <div key={h} className="absolute w-full border-t border-border/30"
                  style={{ top: `${((h - 7) / 13) * 100}%` }} />
              ))}
              {dayEntries.map(entry => {
                if (!entry.clockOut) return null;
                const top = toPercent(new Date(entry.clockIn));
                const bottom = toPercent(new Date(entry.clockOut));
                const height = bottom - top;
                const typeInfo = STAMP_IN_TYPES[entry.type as keyof typeof STAMP_IN_TYPES];
                return (
                  <div key={entry.id}
                    className={cn("absolute left-0.5 right-0.5 rounded text-xs p-1 overflow-hidden", typeInfo?.color ?? "bg-blue-600")}
                    style={{ top: `${top}%`, height: `${height}%` }}
                    title={`${typeInfo?.label ?? entry.type}: ${format(new Date(entry.clockIn), "HH:mm")}–${format(new Date(entry.clockOut), "HH:mm")}`}
                  >
                    <span className="text-white font-medium">{typeInfo?.label ?? entry.type}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 5: `src/components/time/table-view.tsx` (Atoss-Style)**

```tsx
"use client";

import { useEffect, useState } from "react";
import { format, getDaysInMonth, getDay, differenceInMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string; clockIn: string; clockOut: string | null; type: string;
}

interface Props {
  year: number; month: number; targetHours?: number;
  onEdit?: (entry: TimeEntry, day: Date) => void;
}

export function TableView({ year, month, targetHours = 8, onEdit }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    fetch(`/api/time-entries/month?year=${year}&month=${month}`)
      .then(r => r.json()).then(d => setEntries(d.entries ?? []));
  }, [year, month]);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));

  function getEntriesForDay(day: number) {
    return entries.filter(e => new Date(e.clockIn).getDate() === day);
  }

  function calcMins(entry: TimeEntry) {
    if (!entry.clockOut) return 0;
    return differenceInMinutes(new Date(entry.clockOut), new Date(entry.clockIn));
  }

  function fmtMins(mins: number) {
    const sign = mins >= 0 ? "+" : "-";
    const abs = Math.abs(mins);
    return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
  }

  function fmtDuration(mins: number) {
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
  }

  let totalActualMins = 0;
  let totalSaldoMins = 0;

  const rows = Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
    const date = new Date(year, month - 1, day);
    const isWeekend = [0, 6].includes(getDay(date));
    const dayEntries = getEntriesForDay(day);
    const actualMins = dayEntries.reduce((s, e) => s + calcMins(e), 0);
    const targetMins = isWeekend ? 0 : targetHours * 60;
    const saldoMins = actualMins - targetMins;
    if (!isWeekend) { totalActualMins += actualMins; totalSaldoMins += saldoMins; }
    return { day, date, isWeekend, dayEntries, actualMins, targetMins, saldoMins };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 px-3 font-medium">Tag</th>
            <th className="text-left py-2 px-3 font-medium">Typ</th>
            <th className="text-center py-2 px-3 font-medium">Einstpl.</th>
            <th className="text-center py-2 px-3 font-medium">Ausstpl.</th>
            <th className="text-center py-2 px-3 font-medium">Ist</th>
            <th className="text-center py-2 px-3 font-medium">Saldo</th>
            <th className="py-2 px-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ day, date, isWeekend, dayEntries, actualMins, saldoMins }) => {
            const hasEntries = dayEntries.length > 0;
            return (
              <tr key={day} className={cn(
                "border-b border-border/50 hover:bg-muted/20 transition-colors",
                isWeekend && "opacity-40"
              )}>
                <td className="py-2 px-3 font-medium">
                  {format(date, "EEE, dd.MM.", { locale: de })}
                </td>
                <td className="py-2 px-3">
                  {hasEntries ? (
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(dayEntries.map(e => e.type))].map(t => {
                        const info = STAMP_IN_TYPES[t as keyof typeof STAMP_IN_TYPES];
                        return <Badge key={t} className={cn("text-xs", info?.color ?? "bg-muted")}>{info?.label ?? t}</Badge>;
                      })}
                    </div>
                  ) : "—"}
                </td>
                <td className="py-2 px-3 text-center font-mono text-xs">
                  {hasEntries ? format(new Date(dayEntries[0].clockIn), "HH:mm") : "—"}
                </td>
                <td className="py-2 px-3 text-center font-mono text-xs">
                  {hasEntries && dayEntries[dayEntries.length - 1].clockOut
                    ? format(new Date(dayEntries[dayEntries.length - 1].clockOut!), "HH:mm")
                    : "—"}
                </td>
                <td className="py-2 px-3 text-center font-mono text-xs">
                  {hasEntries ? fmtDuration(actualMins) : "0:00"}
                </td>
                <td className={cn("py-2 px-3 text-center font-mono text-xs font-semibold",
                  !isWeekend && (saldoMins >= 0 ? "text-green-400" : "text-red-400"))}>
                  {!isWeekend ? fmtMins(saldoMins) : "—"}
                </td>
                <td className="py-2 px-3 text-right">
                  {!isWeekend && onEdit && hasEntries && (
                    <Button variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => onEdit(dayEntries[0], date)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td colSpan={4} className="py-2 px-3 text-muted-foreground">Gesamt</td>
            <td className="py-2 px-3 text-center font-mono text-sm">{fmtDuration(totalActualMins)}</td>
            <td className={cn("py-2 px-3 text-center font-mono text-sm",
              totalSaldoMins >= 0 ? "text-green-400" : "text-red-400")}>
              {fmtMins(totalSaldoMins)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

**Step 6: Zeitansicht-Seite zusammenbauen**

Ersetze `src/app/dashboard/zeitansicht/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { addMonths, subMonths, addWeeks, subWeeks, format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ViewToggle, type ViewMode } from "@/components/time/view-toggle";
import { MonthCalendar } from "@/components/time/month-calendar";
import { WeekView } from "@/components/time/week-view";
import { TableView } from "@/components/time/table-view";

export default function ZeitansichtPage() {
  const [mode, setMode] = useState<ViewMode>("table");
  const [date, setDate] = useState(new Date());

  function prev() { setDate(d => mode === "week" ? subWeeks(d, 1) : subMonths(d, 1)); }
  function next() { setDate(d => mode === "week" ? addWeeks(d, 1) : addMonths(d, 1)); }

  const title = mode === "week"
    ? `KW ${format(date, "ww", { locale: de })} — ${format(date, "MMMM yyyy", { locale: de })}`
    : format(date, "MMMM yyyy", { locale: de });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Zeitübersicht</h1>
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-medium w-56 text-center">{title}</span>
        <Button variant="outline" size="icon" onClick={next}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {mode === "month" && (
        <MonthCalendar year={date.getFullYear()} month={date.getMonth() + 1} />
      )}
      {mode === "week" && <WeekView date={date} />}
      {mode === "table" && (
        <TableView
          year={date.getFullYear()}
          month={date.getMonth() + 1}
          onEdit={(entry, day) => {
            // Zeitkorrektur-Modal — Task 4
            console.log("edit", entry, day);
          }}
        />
      )}
    </div>
  );
}
```

**Step 7: Build prüfen**

```bash
npm run build
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add 3-mode time view — month calendar, week bars, Atoss-style table"
```

---

## Task 4: Zeitkorrektur durch Mitarbeiter

**Files:**
- Create: `src/app/api/time-entries/edit-request/route.ts`
- Create: `src/components/time/edit-request-modal.tsx`
- Modify: `src/app/dashboard/zeitansicht/page.tsx`

**Step 1: API — Korrekturantrag einreichen**

`src/app/api/time-entries/edit-request/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { timeEntryId, newType, newClockIn, newClockOut, reason } = body;

  if (!timeEntryId || !reason) {
    return NextResponse.json({ error: "timeEntryId und reason sind Pflichtfelder" }, { status: 400 });
  }

  // Prüfen ob Entry dem User gehört
  const entry = await db.timeEntry.findFirst({
    where: { id: timeEntryId, userId: session.user.id },
  });
  if (!entry) return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });

  // Prüfen ob innerhalb des erlaubten Zeitraums
  const config = await db.systemConfig.findUnique({ where: { key: "maxCorrectionDays" } });
  const maxDays = parseInt(config?.value ?? "7");
  const diffDays = (Date.now() - new Date(entry.clockIn).getTime()) / 86400000;
  if (diffDays > maxDays) {
    return NextResponse.json({
      error: `Korrekturen sind nur bis ${maxDays} Tage rückwirkend möglich`
    }, { status: 400 });
  }

  // Validierung
  if (newType && !Object.keys(STAMP_IN_TYPES).includes(newType)) {
    return NextResponse.json({ error: "Ungültiger Typ" }, { status: 400 });
  }

  const editRequest = await db.timeEntryEditRequest.create({
    data: {
      timeEntryId,
      userId: session.user.id,
      newType,
      newClockIn: newClockIn ? new Date(newClockIn) : null,
      newClockOut: newClockOut ? new Date(newClockOut) : null,
      reason,
    },
  });

  // Notification an Manager
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, managerId: true },
  });

  if (user?.managerId) {
    await db.notification.create({
      data: {
        userId: user.managerId,
        senderId: session.user.id,
        type: "CORRECTION",
        title: `Zeitkorrektur-Antrag von ${user.name}`,
        body: `Grund: ${reason}`,
        link: `/dashboard/team`,
      },
    });
  }

  return NextResponse.json({ editRequest }, { status: 201 });
}
```

**Step 2: API — Korrekturantrag genehmigen/ablehnen**

`src/app/api/admin/time-entries/edit-request/[id]/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "time_entries", "write", "all");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { id } = await params;
  const { status } = await req.json();

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const editRequest = await db.timeEntryEditRequest.findUnique({ where: { id } });
  if (!editRequest) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await db.$transaction(async (tx) => {
    await tx.timeEntryEditRequest.update({
      where: { id },
      data: { status, reviewedBy: session.user.id, reviewedAt: new Date() },
    });

    if (status === "APPROVED") {
      const updateData: Record<string, unknown> = {};
      if (editRequest.newType) updateData.type = editRequest.newType;
      if (editRequest.newClockIn) updateData.clockIn = editRequest.newClockIn;
      if (editRequest.newClockOut) updateData.clockOut = editRequest.newClockOut;
      updateData.correctedBy = session.user.id;
      updateData.correctedAt = new Date();

      await tx.timeEntry.update({ where: { id: editRequest.timeEntryId }, data: updateData });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          resource: "time_entries",
          resourceId: editRequest.timeEntryId,
          newValue: updateData,
        },
      });
    }

    // Notification an Mitarbeiter
    const user = await tx.user.findUnique({
      where: { id: editRequest.userId },
      select: { name: true },
    });
    await tx.notification.create({
      data: {
        userId: editRequest.userId,
        type: "CORRECTION",
        title: status === "APPROVED"
          ? "Ihre Zeitkorrektur wurde genehmigt"
          : "Ihre Zeitkorrektur wurde abgelehnt",
        body: `Antrag vom ${new Date(editRequest.createdAt).toLocaleDateString("de")}`,
        link: "/dashboard/zeitansicht",
      },
    });
  });

  return NextResponse.json({ success: true });
}
```

**Step 3: `src/components/time/edit-request-modal.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAMP_IN_TYPES, type StampInType } from "@/lib/stamp-types";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: { id: string; clockIn: string; clockOut: string | null; type: string } | null;
}

export function EditRequestModal({ open, onClose, onSuccess, entry }: Props) {
  const [type, setType] = useState<StampInType | "">("") ;
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/time-entries/edit-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeEntryId: entry.id,
        newType: type || undefined,
        newClockIn: clockIn ? `${format(new Date(entry.clockIn), "yyyy-MM-dd")}T${clockIn}` : undefined,
        newClockOut: clockOut ? `${format(new Date(entry.clockIn), "yyyy-MM-dd")}T${clockOut}` : undefined,
        reason,
      }),
    });

    if (res.ok) {
      setReason(""); setType(""); setClockIn(""); setClockOut("");
      onSuccess();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error ?? "Fehler");
    }
    setLoading(false);
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zeitkorrektur beantragen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Eintrag: {format(new Date(entry.clockIn), "dd.MM.yyyy")} —{" "}
            {STAMP_IN_TYPES[entry.type as StampInType]?.label ?? entry.type}
          </div>

          <div className="space-y-2">
            <Label>Neuer Typ (optional)</Label>
            <Select value={type} onValueChange={(v) => setType(v as StampInType)}>
              <SelectTrigger><SelectValue placeholder="Unverändert" /></SelectTrigger>
              <SelectContent>
                {Object.entries(STAMP_IN_TYPES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Neue Einzeit (optional)</Label>
              <Input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Neue Auszeit (optional)</Label>
              <Input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Begründung *</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Bitte begründe die Korrektur..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={loading || !reason}>
              {loading ? "Wird eingereicht..." : "Antrag stellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Zeitansicht-Seite mit Modal verbinden**

In `src/app/dashboard/zeitansicht/page.tsx` füge oben hinzu:

```tsx
import { EditRequestModal } from "@/components/time/edit-request-modal";
```

Ergänze state:
```tsx
const [editEntry, setEditEntry] = useState<{ id: string; clockIn: string; clockOut: string | null; type: string } | null>(null);
```

Ändere `onEdit` im TableView:
```tsx
onEdit={(entry) => setEditEntry(entry)}
```

Füge Modal am Ende des JSX ein:
```tsx
<EditRequestModal
  open={!!editEntry}
  onClose={() => setEditEntry(null)}
  onSuccess={() => setDate(d => new Date(d))}
  entry={editEntry}
/>
```

**Step 5: Build prüfen + Commit**

```bash
npm run build
git add -A
git commit -m "feat: add employee time correction requests with audit log and manager notification"
```

---

## Task 5: Dashboard Cockpit — Widgets

**Files:**
- Create: `src/app/api/dashboard/stats/route.ts`
- Create: `src/components/dashboard/time-account-widget.tsx`
- Create: `src/components/dashboard/team-status-widget.tsx`
- Create: `src/components/dashboard/quick-actions-widget.tsx`
- Create: `src/components/dashboard/pending-requests-widget.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Dashboard Stats API**

`src/app/api/dashboard/stats/route.ts`:

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const now = new Date();

  // Zeitkonto-Daten (aktueller Monat)
  const monthEntries = await db.timeEntry.findMany({
    where: {
      userId,
      clockIn: { gte: startOfMonth(now), lte: endOfMonth(now) },
      clockOut: { not: null },
    },
  });

  const actualMins = monthEntries.reduce((sum, e) => {
    return sum + Math.floor((new Date(e.clockOut!).getTime() - new Date(e.clockIn).getTime()) / 60000);
  }, 0);

  // Resturlaub
  const approvedVacation = await db.request.count({
    where: {
      userId,
      type: "VACATION",
      status: "APPROVED",
      dateFrom: { gte: new Date(now.getFullYear(), 0, 1) },
    },
  });

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { workingTimeModel: true },
  });

  const vacationTotal = user?.workingTimeModel?.vacationDaysPerYear ?? 28;
  const vacationLeft = vacationTotal - approvedVacation;

  // Team-Status (heute)
  const teamMembers = await db.user.findMany({
    where: { managerId: userId, isActive: true },
    select: {
      id: true, name: true,
      timeEntries: {
        where: { clockIn: { gte: startOfDay(now), lte: endOfDay(now) } },
        orderBy: { clockIn: "desc" },
        take: 1,
      },
    },
  });

  // Offene Anträge
  const pendingRequests = await db.request.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    timeAccount: {
      actualMins,
      targetMins: 22 * (user?.workingTimeModel?.hoursPerDay ?? 8) * 60, // ~22 Arbeitstage
      vacationLeft,
      vacationTotal,
    },
    team: teamMembers.map(m => ({
      id: m.id,
      name: m.name,
      activeType: m.timeEntries[0]?.clockOut === null ? m.timeEntries[0]?.type : null,
    })),
    pendingRequests,
  });
}
```

**Step 2: `src/components/dashboard/time-account-widget.tsx`**

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  actualMins: number;
  targetMins: number;
  vacationLeft: number;
  vacationTotal: number;
}

export function TimeAccountWidget({ actualMins, targetMins, vacationLeft, vacationTotal }: Props) {
  const saldoMins = actualMins - targetMins;
  const isPositive = saldoMins >= 0;
  const saldoH = Math.floor(Math.abs(saldoMins) / 60);
  const saldoM = Math.abs(saldoMins) % 60;
  const vacationPercent = Math.round((vacationLeft / vacationTotal) * 100);

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Mein Zeitkonto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gleitzeitkonto */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPositive
              ? <TrendingUp className="h-4 w-4 text-green-400" />
              : <TrendingDown className="h-4 w-4 text-red-400" />}
            <span className="text-sm text-muted-foreground">Gleitzeitkonto</span>
          </div>
          <span className={cn("text-lg font-bold font-mono", isPositive ? "text-green-400" : "text-red-400")}>
            {isPositive ? "+" : "-"}{saldoH}:{String(saldoM).padStart(2, "0")}h
          </span>
        </div>

        {/* Resturlaub */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Palmtree className="h-4 w-4 text-blue-400" />
              <span className="text-muted-foreground">Resturlaub</span>
            </div>
            <span className="font-medium">{vacationLeft} / {vacationTotal} Tage</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${vacationPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: `src/components/dashboard/team-status-widget.tsx`**

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string; name: string; activeType: string | null;
}

interface Props { team: TeamMember[]; }

export function TeamStatusWidget({ team }: Props) {
  if (team.length === 0) return null;

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Team heute ({team.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {team.map(m => {
            const typeInfo = m.activeType
              ? STAMP_IN_TYPES[m.activeType as keyof typeof STAMP_IN_TYPES]
              : null;
            const initials = m.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{m.name}</span>
                </div>
                {typeInfo ? (
                  <Badge className={cn("text-xs", typeInfo.color)}>{typeInfo.label}</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Abwesend</Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 4: `src/components/dashboard/quick-actions-widget.tsx`**

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palmtree, Stethoscope, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

export function QuickActionsWidget() {
  const router = useRouter();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Schnellaktionen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" className="w-full justify-start gap-2 text-sm"
          onClick={() => router.push("/dashboard/antraege")}>
          <Palmtree className="h-4 w-4 text-blue-400" /> Urlaub beantragen
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2 text-sm"
          onClick={() => router.push("/dashboard/antraege")}>
          <Stethoscope className="h-4 w-4 text-red-400" /> Krankmeldung
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2 text-sm"
          onClick={() => router.push("/dashboard/zeitansicht")}>
          <Clock className="h-4 w-4 text-yellow-400" /> Zeitkorrektur
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 5: `src/components/dashboard/pending-requests-widget.tsx`**

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REQUEST_TYPES } from "@/lib/request-types";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Request {
  id: string; type: string; dateFrom: string; status: string;
}

interface Props { requests: Request[]; }

export function PendingRequestsWidget({ requests }: Props) {
  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Offene Anträge</CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Anträge</p>
        ) : (
          <div className="space-y-2">
            {requests.map(r => {
              const typeInfo = REQUEST_TYPES[r.type as keyof typeof REQUEST_TYPES];
              return (
                <div key={r.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{typeInfo?.label ?? r.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.dateFrom), "dd.MM.yyyy", { locale: de })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">Ausstehend</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 6: Dashboard-Seite zusammenbauen**

Ersetze `src/app/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ClockWidget } from "@/components/dashboard/clock-widget";
import { TimeAccountWidget } from "@/components/dashboard/time-account-widget";
import { TeamStatusWidget } from "@/components/dashboard/team-status-widget";
import { QuickActionsWidget } from "@/components/dashboard/quick-actions-widget";
import { PendingRequestsWidget } from "@/components/dashboard/pending-requests-widget";

interface DashboardStats {
  timeAccount: { actualMins: number; targetMins: number; vacationLeft: number; vacationTotal: number };
  team: { id: string; name: string; activeType: string | null }[];
  pendingRequests: { id: string; type: string; dateFrom: string; status: string }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then(r => r.json())
      .then(setStats);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-4 gap-4">
        <ClockWidget />
        {stats && <TimeAccountWidget {...stats.timeAccount} />}
        {stats && stats.team.length > 0 && <TeamStatusWidget team={stats.team} />}
        <QuickActionsWidget />
        {stats && <PendingRequestsWidget requests={stats.pendingRequests} />}
      </div>
    </div>
  );
}
```

**Step 7: Build prüfen + Commit**

```bash
npm run build
git add -A
git commit -m "feat: add dashboard cockpit with time account, team status, quick actions widgets"
```

---

## Task 6: Notification-System (In-App + Push + E-Mail)

**Files:**
- Install: `npm install web-push nodemailer`
- Install: `npm install -D @types/web-push @types/nodemailer`
- Create: `src/lib/notifications.ts`
- Create: `src/lib/email.ts`
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/unread-count/route.ts`
- Create: `src/app/api/notifications/subscribe/route.ts`
- Create: `src/app/api/notifications/send/route.ts`
- Create: `src/components/notifications/notification-bell.tsx`
- Create: `src/app/dashboard/nachrichten/page.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Packages installieren**

```bash
npm install web-push nodemailer
npm install -D @types/web-push @types/nodemailer
```

**Step 2: VAPID Keys generieren und in .env.local eintragen**

```bash
node -e "const wp = require('web-push'); const keys = wp.generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=' + keys.publicKey); console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);"
```

Füge die Ausgabe zu `.env.local` hinzu:
```env
VAPID_PUBLIC_KEY=<output>
VAPID_PRIVATE_KEY=<output>
VAPID_SUBJECT=mailto:admin@firma.de
```

**Step 3: `src/lib/notifications.ts`**

```ts
import { db } from "@/lib/db";
import webpush from "web-push";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@firma.de",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function createNotification({
  userId,
  senderId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  senderId?: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}) {
  const notification = await db.notification.create({
    data: { userId, senderId, type, title, body, link },
  });

  // Browser Push
  const pref = await db.notificationPreference.findUnique({ where: { userId } });
  if (pref?.browserPushEnabled && pref.pushSubscription) {
    try {
      await webpush.sendNotification(
        pref.pushSubscription as webpush.PushSubscription,
        JSON.stringify({ title, body, link })
      );
    } catch {
      // Push fehlgeschlagen — kein Crash
    }
  }

  // E-Mail
  if (pref?.emailEnabled) {
    const { sendEmail } = await import("@/lib/email");
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      await sendEmail({ to: user.email, subject: title, text: body }).catch(() => {});
    }
  }

  return notification;
}
```

**Step 4: `src/lib/email.ts`**

```ts
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

export async function sendEmail({
  to, subject, text,
}: { to: string; subject: string; text: string }) {
  const configs = await db.systemConfig.findMany({
    where: { key: { in: ["smtpHost", "smtpPort", "smtpUser", "smtpPassword", "smtpFrom"] } },
  });

  const cfg = Object.fromEntries(configs.map(c => [c.key, c.value]));
  if (!cfg.smtpHost) return; // SMTP nicht konfiguriert

  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: parseInt(cfg.smtpPort ?? "587"),
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPassword ?? "" } : undefined,
  });

  await transporter.sendMail({
    from: cfg.smtpFrom ?? "zeiterfassung@firma.de",
    to, subject, text,
  });
}
```

**Step 5: Notification APIs**

`src/app/api/notifications/route.ts`:
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    include: { sender: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Als gelesen markieren
  await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ notifications });
}
```

`src/app/api/notifications/unread-count/route.ts`:
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ count: 0 });

  const count = await db.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return NextResponse.json({ count });
}
```

`src/app/api/notifications/send/route.ts`:
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recipientId, title, body, link } = await req.json();
  if (!recipientId || !title || !body) {
    return NextResponse.json({ error: "recipientId, title und body sind Pflichtfelder" }, { status: 400 });
  }

  const sender = await db.user.findUnique({
    where: { id: session.user.id }, select: { name: true },
  });

  const notification = await createNotification({
    userId: recipientId,
    senderId: session.user.id,
    type: "MESSAGE",
    title: `${sender?.name}: ${title}`,
    body,
    link,
  });

  return NextResponse.json({ notification }, { status: 201 });
}
```

`src/app/api/notifications/subscribe/route.ts`:
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await req.json();

  await db.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: { browserPushEnabled: true, pushSubscription: subscription },
    create: {
      userId: session.user.id,
      browserPushEnabled: true,
      pushSubscription: subscription,
    },
  });

  return NextResponse.json({ success: true });
}
```

**Step 6: `src/components/notifications/notification-bell.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    async function fetchCount() {
      const res = await fetch("/api/notifications/unread-count");
      const data = await res.json();
      setCount(data.count ?? 0);
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Button variant="ghost" size="icon" className="relative"
      onClick={() => router.push("/dashboard/nachrichten")}>
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Button>
  );
}
```

**Step 7: Header erweitern**

In `src/components/layout/header.tsx` füge den Import hinzu:
```tsx
import { NotificationBell } from "@/components/notifications/notification-bell";
```

Füge `<NotificationBell />` vor dem `<DropdownMenu>` ein.

**Step 8: Nachrichten-Seite**

`src/app/dashboard/nachrichten/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Bell, MessageSquare, CheckCircle2 } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  sender: { name: string } | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  MESSAGE: MessageSquare,
  SYSTEM: Bell,
  APPROVAL: CheckCircle2,
  CORRECTION: CheckCircle2,
};

export default function NachrichtenPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => { setNotifications(d.notifications ?? []); setLoading(false); });
  }, []);

  if (loading) return <div className="text-muted-foreground text-sm p-6">Lade Nachrichten...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Nachrichten</h1>
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Keine Nachrichten
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            return (
              <Card key={n.id} className={n.isRead ? "opacity-70" : ""}>
                <CardContent className="p-4 flex gap-3">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{n.title}</p>
                      {!n.isRead && <Badge className="text-xs bg-blue-600">Neu</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.sender ? `Von: ${n.sender.name} · ` : ""}
                      {format(new Date(n.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 9: Sidebar-Link für Nachrichten**

In `src/components/layout/sidebar.tsx` — füge `MessageSquare` zu den Imports hinzu und ergänze den navItems Array:
```ts
{ href: "/dashboard/nachrichten", icon: MessageSquare, label: "Nachrichten" },
```

**Step 10: Build prüfen + Commit**

```bash
npm run build
git add -A
git commit -m "feat: add bidirectional notification system with in-app, push, and email delivery"
```

---

## Task 7: Manager/HR Teamansicht pro Mitarbeiter

**Files:**
- Create: `src/app/api/team/members/route.ts`
- Create: `src/app/api/team/members/[userId]/stats/route.ts`
- Create: `src/app/dashboard/team/page.tsx` (erweitern)
- Create: `src/app/dashboard/team/[userId]/page.tsx`

**Step 1: Team-Members API**

`src/app/api/team/members/route.ts`:
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "employees", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  // HR/Admin sieht alle, Manager sieht sein Team
  const scope = await import("@/lib/permissions").then(m =>
    m.getPermissionScope(session.user.id, "employees", "read")
  );

  const where = scope === "all" ? {} : { managerId: session.user.id };

  const members = await db.user.findMany({
    where: { ...where, isActive: true },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ members });
}
```

**Step 2: Mitarbeiter-Detail-Stats API**

`src/app/api/team/members/[userId]/stats/route.ts`:
```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "time_entries", "read", "team");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const monthDate = new Date(year, month - 1, 1);

  const [timeEntries, requests, user] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        userId,
        clockIn: { gte: startOfMonth(monthDate), lte: endOfMonth(monthDate) },
      },
      orderBy: { clockIn: "asc" },
    }),
    db.request.findMany({
      where: {
        userId,
        status: { in: ["APPROVED", "PENDING"] },
        dateFrom: { gte: startOfYear(monthDate), lte: endOfYear(monthDate) },
      },
      orderBy: { dateFrom: "asc" },
    }),
    db.user.findUnique({
      where: { id: userId },
      include: { workingTimeModel: true },
    }),
  ]);

  return NextResponse.json({ timeEntries, requests, user });
}
```

**Step 3: Mitarbeiter-Detail-Seite**

`src/app/dashboard/team/[userId]/page.tsx`:
```tsx
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { MemberDetailView } from "@/components/team/member-detail-view";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = await hasPermission(session.user.id, "time_entries", "read", "team");
  if (!canRead) redirect("/dashboard");

  const { userId } = await params;
  const member = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, department: true },
  });

  if (!member) redirect("/dashboard/team");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{member.name}</h1>
        <p className="text-muted-foreground">{member.email} · {member.department ?? "Keine Abteilung"}</p>
      </div>
      <MemberDetailView userId={userId} />
    </div>
  );
}
```

**Step 4: `src/components/team/member-detail-view.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableView } from "@/components/time/table-view";
import { addMonths, subMonths, format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props { userId: string; }

export function MemberDetailView({ userId }: Props) {
  const [date, setDate] = useState(new Date());

  // Spezieller TableView-Fetch für fremden User
  // Wir nutzen einen Query-Param userId, der nur für Manager/HR erlaubt ist
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return (
    <Tabs defaultValue="time">
      <TabsList>
        <TabsTrigger value="time">Zeitübersicht</TabsTrigger>
        <TabsTrigger value="requests">Anträge</TabsTrigger>
      </TabsList>

      <TabsContent value="time" className="space-y-4 mt-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setDate(d => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium w-40 text-center">
            {format(date, "MMMM yyyy", { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setDate(d => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <AdminTableView userId={userId} year={year} month={month} />
      </TabsContent>

      <TabsContent value="requests" className="mt-4">
        <MemberRequestsList userId={userId} />
      </TabsContent>
    </Tabs>
  );
}

// Separate Komponente die /api/team/members/[userId]/stats nutzt
function AdminTableView({ userId, year, month }: { userId: string; year: number; month: number }) {
  const [entries, setEntries] = useState<{ id: string; clockIn: string; clockOut: string | null; type: string }[]>([]);

  useState(() => {
    fetch(`/api/team/members/${userId}/stats?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setEntries(d.timeEntries ?? []));
  });

  return <TableView year={year} month={month} />;
}

function MemberRequestsList({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<{ id: string; type: string; dateFrom: string; dateTo: string; status: string }[]>([]);

  useState(() => {
    fetch(`/api/team/members/${userId}/stats`)
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []));
  });

  return (
    <div className="space-y-2">
      {requests.map(r => (
        <div key={r.id} className="flex items-center justify-between p-3 border border-border rounded-md">
          <div>
            <p className="text-sm font-medium">{r.type}</p>
            <p className="text-xs text-muted-foreground">{r.dateFrom} – {r.dateTo}</p>
          </div>
          <span className="text-xs text-muted-foreground">{r.status}</span>
        </div>
      ))}
    </div>
  );
}
```

**Step 5: Team-Übersichtsseite mit Mitarbeiterliste**

Ersetze `src/app/dashboard/team/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { ApprovalList } from "@/components/team/approval-list";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Member { id: string; name: string; email: string; department: string | null; }

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    fetch("/api/team/members")
      .then(r => r.json())
      .then(d => setMembers(d.members ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals">Offene Anträge</TabsTrigger>
          <TabsTrigger value="members">Mitarbeiter</TabsTrigger>
        </TabsList>
        <TabsContent value="approvals" className="mt-4">
          <ApprovalList />
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <div className="space-y-2 max-w-2xl">
            {members.map(m => (
              <Card key={m.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-sm text-muted-foreground">{m.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/team/${m.id}`}>
                      Details <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 6: Build prüfen + Commit**

```bash
npm run build
git add -A
git commit -m "feat: add manager/HR team member detail view with time overview and requests"
```

---

## Abschluss-Checkliste Phase 2

- [ ] DB-Migration erfolgreich (`npx prisma migrate dev`)
- [ ] Stempeluhr: 7 Einstempel-Typen + Gehen funktionieren
- [ ] Zeitansicht: Monat / Woche / Tabelle umschaltbar
- [ ] Zeitkorrektur-Modal: Antrag einreichbar mit Begründung
- [ ] Dashboard: Alle Widgets sichtbar
- [ ] Notifications: Bell-Icon zeigt ungelesene Anzahl
- [ ] Nachrichten-Seite: Liste aller Notifications
- [ ] Team-Seite: Mitarbeiterliste + Detail-Seite erreichbar
- [ ] `npm run build` ohne Fehler
- [ ] `npm test` grün
