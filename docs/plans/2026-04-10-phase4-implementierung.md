# Phase 4 — Enterprise Settings Implementierungsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Vollständiges Enterprise-Einstellungssystem — alle SystemConfig-Keys + 5-Tab Settings-UI + Business-Logic-Integration

**Architecture:** SystemConfig-Tabelle (Key-Value) als Single Source of Truth. Settings-API mit gruppierten GET/PATCH. shadcn/ui Tabs in `/dashboard/einstellungen`. Business-Logic liest Settings aus DB.

**Tech Stack:** Next.js 16, Prisma 7, shadcn/ui, date-fns

---

## SystemConfig Key-Schema (vollständig)

```
# Arbeitszeit
workday.maxHoursPerDay        = "10"
workday.maxHoursPerWeek       = "48"
workday.minRestHours          = "11"
workday.autoBreakEnabled      = "true"     ← bereits vorhanden
workday.autoBreakAfterHours   = "6"        ← bereits vorhanden
workday.autoBreakMinutes      = "30"       ← bereits vorhanden
workday.extBreakAfterHours    = "9"
workday.extBreakMinutes       = "45"
workday.flexiStart            = "06:00"
workday.flexiEnd              = "22:00"
workday.coreStart             = ""
workday.coreEnd               = ""
workday.autoClockout          = "false"
workday.autoClockoutTime      = "22:00"
workday.forgotClockoutHours   = "1"

# Urlaub & Abwesenheit
vacation.carryoverEnabled     = "true"
vacation.carryoverMonth       = "3"
vacation.carryoverDay         = "31"
vacation.maxConsecutiveDays   = "30"
vacation.minNoticeDays        = "3"
vacation.sickNoteAfterDays    = "3"
homeoffice.maxPerMonth        = "10"
homeoffice.maxPerWeek         = "3"
homeoffice.requireApproval    = "true"

# Genehmigung
approval.vacationApprover     = "manager"
approval.correctionApprover   = "manager"
approval.escalationDays       = "3"
approval.multiStageAboveDays  = "14"

# Stempel
stamp.mobileAllowed           = "true"
stamp.geofencingEnabled       = "false"
stamp.geofencingRadius        = "500"
stamp.geofencingLat           = ""
stamp.geofencingLng           = ""
stamp.ipWhitelistEnabled      = "false"
stamp.ipWhitelist             = ""

# Feiertage
holidays.state                = "NW"
holidays.customDays           = "[]"

# Benachrichtigungen
notify.forgotClockout         = "true"
notify.lowVacationDays        = "5"
notify.overtimeAlertHours     = "40"
notify.dailySummaryEnabled    = "false"
notify.dailySummaryTime       = "17:00"

# Sicherheit
security.passwordMinLength    = "8"
security.passwordRequireSpec  = "false"
security.passwordExpiryDays   = "0"
security.maxLoginAttempts     = "5"
security.sessionTimeoutMins   = "480"
security.allowRememberMe      = "true"

# Branding
branding.companyName          = "Mein Unternehmen"
branding.primaryColor         = "#3b82f6"
branding.language             = "de"

# Export
export.payrollDay             = "25"
export.csvSeparator           = ";"
export.csvDateFormat          = "dd.MM.yyyy"
export.autoExportEnabled      = "false"
export.autoExportEmail        = ""
```

---

## Task 1: Alle SystemConfig-Keys seeden

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: seed.ts erweitern**

Füge nach den bestehenden SystemConfig-Upserts folgende Keys hinzu:

```ts
  const newConfigs = [
    // Arbeitszeit
    { key: "workday.maxHoursPerDay", value: "10" },
    { key: "workday.maxHoursPerWeek", value: "48" },
    { key: "workday.minRestHours", value: "11" },
    { key: "workday.extBreakAfterHours", value: "9" },
    { key: "workday.extBreakMinutes", value: "45" },
    { key: "workday.flexiStart", value: "06:00" },
    { key: "workday.flexiEnd", value: "22:00" },
    { key: "workday.coreStart", value: "" },
    { key: "workday.coreEnd", value: "" },
    { key: "workday.autoClockout", value: "false" },
    { key: "workday.autoClockoutTime", value: "22:00" },
    { key: "workday.forgotClockoutHours", value: "1" },
    // Urlaub
    { key: "vacation.carryoverEnabled", value: "true" },
    { key: "vacation.carryoverMonth", value: "3" },
    { key: "vacation.carryoverDay", value: "31" },
    { key: "vacation.maxConsecutiveDays", value: "30" },
    { key: "vacation.minNoticeDays", value: "3" },
    { key: "vacation.sickNoteAfterDays", value: "3" },
    // Homeoffice
    { key: "homeoffice.maxPerMonth", value: "10" },
    { key: "homeoffice.maxPerWeek", value: "3" },
    { key: "homeoffice.requireApproval", value: "true" },
    // Genehmigung
    { key: "approval.vacationApprover", value: "manager" },
    { key: "approval.correctionApprover", value: "manager" },
    { key: "approval.escalationDays", value: "3" },
    { key: "approval.multiStageAboveDays", value: "14" },
    // Stempel
    { key: "stamp.mobileAllowed", value: "true" },
    { key: "stamp.geofencingEnabled", value: "false" },
    { key: "stamp.geofencingRadius", value: "500" },
    { key: "stamp.geofencingLat", value: "" },
    { key: "stamp.geofencingLng", value: "" },
    { key: "stamp.ipWhitelistEnabled", value: "false" },
    { key: "stamp.ipWhitelist", value: "" },
    // Feiertage
    { key: "holidays.state", value: "NW" },
    { key: "holidays.customDays", value: "[]" },
    // Benachrichtigungen
    { key: "notify.forgotClockout", value: "true" },
    { key: "notify.lowVacationDays", value: "5" },
    { key: "notify.overtimeAlertHours", value: "40" },
    { key: "notify.dailySummaryEnabled", value: "false" },
    { key: "notify.dailySummaryTime", value: "17:00" },
    // Sicherheit
    { key: "security.passwordMinLength", value: "8" },
    { key: "security.passwordRequireSpec", value: "false" },
    { key: "security.passwordExpiryDays", value: "0" },
    { key: "security.maxLoginAttempts", value: "5" },
    { key: "security.sessionTimeoutMins", value: "480" },
    { key: "security.allowRememberMe", value: "true" },
    // Branding
    { key: "branding.companyName", value: "Mein Unternehmen" },
    { key: "branding.primaryColor", value: "#3b82f6" },
    { key: "branding.language", value: "de" },
    // Export
    { key: "export.payrollDay", value: "25" },
    { key: "export.csvSeparator", value: ";" },
    { key: "export.csvDateFormat", value: "dd.MM.yyyy" },
    { key: "export.autoExportEnabled", value: "false" },
    { key: "export.autoExportEmail", value: "" },
  ];

  for (const cfg of newConfigs) {
    await db.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }
```

**Step 2: Seed ausführen**
```bash
npx prisma db seed
```

**Step 3: `src/lib/settings.ts` erstellen — typsichere Settings-Helfer**

```ts
import { db } from "@/lib/db";

export type SettingsGroup =
  | "workday"
  | "vacation"
  | "homeoffice"
  | "approval"
  | "stamp"
  | "holidays"
  | "notify"
  | "security"
  | "branding"
  | "export";

export async function getSettings(group?: SettingsGroup): Promise<Record<string, string>> {
  const configs = await db.systemConfig.findMany(
    group ? { where: { key: { startsWith: `${group}.` } } } : undefined
  );
  return Object.fromEntries(configs.map((c) => [c.key, c.value]));
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const cfg = await db.systemConfig.findUnique({ where: { key } });
  return cfg?.value ?? fallback;
}

export async function updateSettings(updates: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      db.systemConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
}
```

**Step 4: Commit**
```bash
git add -A && git commit -m "feat: seed all enterprise SystemConfig keys and add settings helpers"
```

---

## Task 2: Settings API

**Files:**
- Create: `src/app/api/admin/settings/route.ts`
- Create: `src/app/api/admin/settings/[group]/route.ts`

**Step 1: `src/app/api/admin/settings/route.ts`**

```ts
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { NextResponse } from "next/server";

const GROUPS = ["workday", "vacation", "homeoffice", "approval", "stamp", "holidays", "notify", "security", "branding", "export"];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canRead = await hasPermission(session.user.id, "roles", "read");
  if (!canRead) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const allConfigs = await db.systemConfig.findMany({ orderBy: { key: "asc" } });
  const grouped: Record<string, Record<string, string>> = {};

  for (const group of GROUPS) {
    grouped[group] = {};
  }

  for (const cfg of allConfigs) {
    const [group, ...rest] = cfg.key.split(".");
    if (grouped[group] !== undefined) {
      grouped[group][rest.join(".")] = cfg.value;
    }
  }

  return NextResponse.json({ settings: grouped });
}
```

**Step 2: `src/app/api/admin/settings/[group]/route.ts`**

```ts
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { updateSettings } from "@/lib/settings";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ group: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "roles", "write");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { group } = await params;
  const body = await req.json();

  // Prefix alle Keys mit der Gruppe
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    updates[`${group}.${key}`] = String(value);
  }

  await updateSettings(updates);
  return NextResponse.json({ success: true });
}
```

**Step 3: Commit**
```bash
git add -A && git commit -m "feat: add settings API with grouped GET and PATCH endpoints"
```

---

## Task 3: Settings UI — Arbeitszeit Tab

**Files:**
- Create: `src/components/settings/workday-settings.tsx`
- Create: `src/components/settings/settings-section.tsx`

**Step 1: `src/components/settings/settings-section.tsx`** (Reusable Wrapper)

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  group: string;
  values: Record<string, string>;
  onSaved?: () => void;
  children: React.ReactNode;
}

export function SettingsSection({ title, description, group, values, onSaved, children }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/settings/${group}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } else {
      const d = await res.json();
      setError(d.error ?? "Fehler");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="shrink-0">
            {saved ? <><Check className="h-3.5 w-3.5 mr-1" />Gespeichert</> :
             saving ? "Speichern..." :
             <><Save className="h-3.5 w-3.5 mr-1" />Speichern</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
```

**Step 2: `src/components/settings/workday-settings.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkdayConfig {
  maxHoursPerDay: string;
  maxHoursPerWeek: string;
  minRestHours: string;
  autoBreakEnabled: string;
  autoBreakAfterHours: string;
  autoBreakMinutes: string;
  extBreakAfterHours: string;
  extBreakMinutes: string;
  flexiStart: string;
  flexiEnd: string;
  coreStart: string;
  coreEnd: string;
  autoClockout: string;
  autoClockoutTime: string;
  forgotClockoutHours: string;
}

export function WorkdaySettings() {
  const [cfg, setCfg] = useState<WorkdayConfig | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => setCfg(d.settings?.workday ?? {}));
  }, []);

  function set(key: keyof WorkdayConfig, value: string) {
    setCfg(prev => prev ? { ...prev, [key]: value } : prev);
  }

  function toggle(key: keyof WorkdayConfig) {
    set(key, cfg?.[key] === "true" ? "false" : "true");
  }

  if (!cfg) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      {/* ArbZG-Grenzen */}
      <SettingsSection title="Gesetzliche Grenzen (ArbZG)" group="workday" values={cfg}
        description="Maximale Arbeitszeiten gemäß Arbeitszeitgesetz">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Max. Stunden/Tag</Label>
            <Input type="number" value={cfg.maxHoursPerDay}
              onChange={e => set("maxHoursPerDay", e.target.value)} min="6" max="10" />
          </div>
          <div className="space-y-2">
            <Label>Max. Stunden/Woche</Label>
            <Input type="number" value={cfg.maxHoursPerWeek}
              onChange={e => set("maxHoursPerWeek", e.target.value)} min="20" max="60" />
          </div>
          <div className="space-y-2">
            <Label>Mindestruhezeit (h)</Label>
            <Input type="number" value={cfg.minRestHours}
              onChange={e => set("minRestHours", e.target.value)} min="8" max="12" />
          </div>
        </div>
      </SettingsSection>

      {/* Pausenregeln */}
      <SettingsSection title="Automatischer Pausenabzug" group="workday" values={cfg}
        description="Pflichtpausen werden automatisch von der Arbeitszeit abgezogen">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Pausenabzug aktiv</p>
            <p className="text-xs text-muted-foreground">Pausen werden automatisch abgezogen</p>
          </div>
          <Switch checked={cfg.autoBreakEnabled === "true"} onCheckedChange={() => toggle("autoBreakEnabled")} />
        </div>
        {cfg.autoBreakEnabled === "true" && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Erste Pause ab (Stunden)</Label>
                <Input type="number" step="0.5" value={cfg.autoBreakAfterHours}
                  onChange={e => set("autoBreakAfterHours", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Erste Pause (Minuten)</Label>
                <Input type="number" value={cfg.autoBreakMinutes}
                  onChange={e => set("autoBreakMinutes", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Erweiterte Pause ab (Stunden)</Label>
                <Input type="number" step="0.5" value={cfg.extBreakAfterHours}
                  onChange={e => set("extBreakAfterHours", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Erweiterte Pause gesamt (Minuten)</Label>
                <Input type="number" value={cfg.extBreakMinutes}
                  onChange={e => set("extBreakMinutes", e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Beispiel: Bei {cfg.autoBreakAfterHours}h+ werden {cfg.autoBreakMinutes}min abgezogen,
              bei {cfg.extBreakAfterHours}h+ werden {cfg.extBreakMinutes}min abgezogen.
            </p>
          </div>
        )}
      </SettingsSection>

      {/* Gleitzeitrahmen */}
      <SettingsSection title="Gleitzeitrahmen" group="workday" values={cfg}
        description="Erlaubter Zeitraum für Ein- und Ausstempeln">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Früheste Einstempelzeit</Label>
            <Input type="time" value={cfg.flexiStart} onChange={e => set("flexiStart", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Späteste Ausstempelzeit</Label>
            <Input type="time" value={cfg.flexiEnd} onChange={e => set("flexiEnd", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Kernzeit von (optional)</Label>
            <Input type="time" value={cfg.coreStart} onChange={e => set("coreStart", e.target.value)} placeholder="z.B. 10:00" />
          </div>
          <div className="space-y-2">
            <Label>Kernzeit bis (optional)</Label>
            <Input type="time" value={cfg.coreEnd} onChange={e => set("coreEnd", e.target.value)} placeholder="z.B. 15:00" />
          </div>
        </div>
      </SettingsSection>

      {/* Automatisches Ausstempeln */}
      <SettingsSection title="Vergessenes Ausstempeln" group="workday" values={cfg}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Automatisches Ausstempeln</p>
            <p className="text-xs text-muted-foreground">Mitarbeiter werden um eine feste Uhrzeit automatisch ausgestempelt</p>
          </div>
          <Switch checked={cfg.autoClockout === "true"} onCheckedChange={() => toggle("autoClockout")} />
        </div>
        {cfg.autoClockout === "true" && (
          <div className="space-y-2">
            <Label>Automatisches Ausstempeln um</Label>
            <Input type="time" value={cfg.autoClockoutTime} onChange={e => set("autoClockoutTime", e.target.value)} className="w-32" />
          </div>
        )}
        <div className="space-y-2">
          <Label>Reminder nach vergessenem Ausstempeln (Stunden)</Label>
          <Input type="number" step="0.5" value={cfg.forgotClockoutHours}
            onChange={e => set("forgotClockoutHours", e.target.value)} className="w-24" />
          <p className="text-xs text-muted-foreground">Mitarbeiter erhalten eine Notification wenn sie noch eingestempelt sind</p>
        </div>
      </SettingsSection>
    </div>
  );
}
```

**Step 3: Commit Task 3**
```bash
git add -A && git commit -m "feat: add workday settings UI with break rules, flexi-time, and auto-clockout config"
```

---

## Task 4: Settings UI — Urlaub, HO & Genehmigung

**Files:**
- Create: `src/components/settings/vacation-settings.tsx`
- Create: `src/components/settings/approval-settings.tsx`

**Step 1: `src/components/settings/vacation-settings.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface VacationConfig {
  carryoverEnabled: string;
  carryoverMonth: string;
  carryoverDay: string;
  maxConsecutiveDays: string;
  minNoticeDays: string;
  sickNoteAfterDays: string;
}

interface HomeofficeCfg {
  maxPerMonth: string;
  maxPerWeek: string;
  requireApproval: string;
}

export function VacationSettings() {
  const [vac, setVac] = useState<VacationConfig | null>(null);
  const [ho, setHo] = useState<HomeofficeCfg | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => {
        setVac(d.settings?.vacation ?? {});
        setHo(d.settings?.homeoffice ?? {});
      });
  }, []);

  if (!vac || !ho) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <SettingsSection title="Urlaubsverwaltung" group="vacation" values={vac}
        description="Regeln für Urlaubsanspruch und -planung">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Resturlaub-Übertrag erlaubt</p>
            <p className="text-xs text-muted-foreground">Nicht genutzter Urlaub wird ins Folgejahr übertragen</p>
          </div>
          <Switch
            checked={vac.carryoverEnabled === "true"}
            onCheckedChange={() => setVac(p => p ? { ...p, carryoverEnabled: p.carryoverEnabled === "true" ? "false" : "true" } : p)}
          />
        </div>
        {vac.carryoverEnabled === "true" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Verfall-Monat</Label>
              <Input type="number" min="1" max="12" value={vac.carryoverMonth}
                onChange={e => setVac(p => p ? { ...p, carryoverMonth: e.target.value } : p)} />
              <p className="text-xs text-muted-foreground">Monat (1=Jan, 3=März)</p>
            </div>
            <div className="space-y-2">
              <Label>Verfall-Tag</Label>
              <Input type="number" min="1" max="31" value={vac.carryoverDay}
                onChange={e => setVac(p => p ? { ...p, carryoverDay: e.target.value } : p)} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Max. Urlaubstage am Stück</Label>
            <Input type="number" value={vac.maxConsecutiveDays}
              onChange={e => setVac(p => p ? { ...p, maxConsecutiveDays: e.target.value } : p)} />
          </div>
          <div className="space-y-2">
            <Label>Vorlaufzeit Urlaubsantrag (Tage)</Label>
            <Input type="number" value={vac.minNoticeDays}
              onChange={e => setVac(p => p ? { ...p, minNoticeDays: e.target.value } : p)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Attest-Pflicht ab Kranktagen</Label>
          <Input type="number" value={vac.sickNoteAfterDays}
            onChange={e => setVac(p => p ? { ...p, sickNoteAfterDays: e.target.value } : p)} className="w-24" />
          <p className="text-xs text-muted-foreground">Ab wie vielen Krankheitstagen ist ein Attest erforderlich</p>
        </div>
      </SettingsSection>

      <SettingsSection title="Homeoffice-Regelungen" group="homeoffice" values={ho}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Max. HO-Tage pro Monat</Label>
            <Input type="number" value={ho.maxPerMonth}
              onChange={e => setHo(p => p ? { ...p, maxPerMonth: e.target.value } : p)} />
          </div>
          <div className="space-y-2">
            <Label>Max. HO-Tage pro Woche</Label>
            <Input type="number" value={ho.maxPerWeek}
              onChange={e => setHo(p => p ? { ...p, maxPerWeek: e.target.value } : p)} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">HO-Antrag Pflicht</p>
            <p className="text-xs text-muted-foreground">Mitarbeiter müssen HO-Tage beantragen</p>
          </div>
          <Switch
            checked={ho.requireApproval === "true"}
            onCheckedChange={() => setHo(p => p ? { ...p, requireApproval: p.requireApproval === "true" ? "false" : "true" } : p)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
```

**Step 2: `src/components/settings/approval-settings.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface ApprovalConfig {
  vacationApprover: string;
  correctionApprover: string;
  escalationDays: string;
  multiStageAboveDays: string;
}

export function ApprovalSettings() {
  const [cfg, setCfg] = useState<ApprovalConfig | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => setCfg(d.settings?.approval ?? {}));
  }, []);

  if (!cfg) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <SettingsSection title="Genehmigungsworkflow" group="approval" values={cfg}
        description="Wer genehmigt welche Antragstypen">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Urlaubsanträge genehmigt durch</Label>
            <Select value={cfg.vacationApprover} onValueChange={v => setCfg(p => p ? { ...p, vacationApprover: v ?? "manager" } : p)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Direkter Vorgesetzter</SelectItem>
                <SelectItem value="hr">HR Admin</SelectItem>
                <SelectItem value="both">Manager + HR (beide)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Zeitkorrekturen genehmigt durch</Label>
            <Select value={cfg.correctionApprover} onValueChange={v => setCfg(p => p ? { ...p, correctionApprover: v ?? "manager" } : p)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Direkter Vorgesetzter</SelectItem>
                <SelectItem value="hr">HR Admin (direkt)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Eskalation nach (Tage ohne Entscheidung)</Label>
            <Input type="number" value={cfg.escalationDays}
              onChange={e => setCfg(p => p ? { ...p, escalationDays: e.target.value } : p)} />
            <p className="text-xs text-muted-foreground">Antrag wird an HR weitergeleitet</p>
          </div>
          <div className="space-y-2">
            <Label>Mehrstufig ab Urlaubstagen</Label>
            <Input type="number" value={cfg.multiStageAboveDays}
              onChange={e => setCfg(p => p ? { ...p, multiStageAboveDays: e.target.value } : p)} />
            <p className="text-xs text-muted-foreground">Manager + HR müssen zustimmen</p>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
```

**Step 3: Commit**
```bash
git add -A && git commit -m "feat: add vacation, homeoffice, and approval settings UI"
```

---

## Task 5: Settings UI — Stempel & Sicherheit

**Files:**
- Create: `src/components/settings/stamp-settings.tsx`
- Create: `src/components/settings/security-settings.tsx`

**Step 1: `src/components/settings/stamp-settings.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MapPin, Wifi } from "lucide-react";

interface StampConfig {
  mobileAllowed: string;
  geofencingEnabled: string;
  geofencingRadius: string;
  geofencingLat: string;
  geofencingLng: string;
  ipWhitelistEnabled: string;
  ipWhitelist: string;
}

export function StampSettings() {
  const [cfg, setCfg] = useState<StampConfig | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => setCfg(d.settings?.stamp ?? {}));
  }, []);

  if (!cfg) return <Skeleton className="h-64" />;

  function toggle(key: keyof StampConfig) {
    setCfg(p => p ? { ...p, [key]: p[key] === "true" ? "false" : "true" } : p);
  }

  return (
    <div className="space-y-4">
      <SettingsSection title="Mobile & Stempel-Einstellungen" group="stamp" values={cfg}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Mobile Stempelung erlaubt</p>
            <p className="text-xs text-muted-foreground">Mitarbeiter können per Smartphone stempeln</p>
          </div>
          <Switch checked={cfg.mobileAllowed === "true"} onCheckedChange={() => toggle("mobileAllowed")} />
        </div>
      </SettingsSection>

      <SettingsSection title="Geofencing" group="stamp" values={cfg}
        description="Stempeln nur im Umkreis des Arbeitsorts erlauben">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Geofencing aktiv</p>
              <p className="text-xs text-muted-foreground">Einstempeln nur innerhalb des definierten Radius</p>
            </div>
          </div>
          <Switch checked={cfg.geofencingEnabled === "true"} onCheckedChange={() => toggle("geofencingEnabled")} />
        </div>
        {cfg.geofencingEnabled === "true" && (
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Erlaubter Radius (Meter)</Label>
              <Input type="number" value={cfg.geofencingRadius}
                onChange={e => setCfg(p => p ? { ...p, geofencingRadius: e.target.value } : p)} className="w-32" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Breitengrad (Latitude)</Label>
                <Input placeholder="z.B. 51.5074" value={cfg.geofencingLat}
                  onChange={e => setCfg(p => p ? { ...p, geofencingLat: e.target.value } : p)} />
              </div>
              <div className="space-y-2">
                <Label>Längengrad (Longitude)</Label>
                <Input placeholder="z.B. 7.4653" value={cfg.geofencingLng}
                  onChange={e => setCfg(p => p ? { ...p, geofencingLng: e.target.value } : p)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              GPS-Koordinaten des Hauptarbeitsorts (Stadion/Büro)
            </p>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="IP-Whitelist" group="stamp" values={cfg}
        description="Stempeln nur aus dem Firmennetz erlauben">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">IP-Einschränkung aktiv</p>
              <p className="text-xs text-muted-foreground">Stempeln nur von erlaubten IP-Adressen</p>
            </div>
          </div>
          <Switch checked={cfg.ipWhitelistEnabled === "true"} onCheckedChange={() => toggle("ipWhitelistEnabled")} />
        </div>
        {cfg.ipWhitelistEnabled === "true" && (
          <div className="space-y-2">
            <Label>Erlaubte IPs (kommagetrennt)</Label>
            <Input
              placeholder="z.B. 192.168.1.0/24, 10.0.0.1"
              value={cfg.ipWhitelist}
              onChange={e => setCfg(p => p ? { ...p, ipWhitelist: e.target.value } : p)}
            />
            <p className="text-xs text-muted-foreground">CIDR-Notation oder einzelne IPs</p>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
```

**Step 2: `src/components/settings/security-settings.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";

interface SecurityConfig {
  passwordMinLength: string;
  passwordRequireSpec: string;
  passwordExpiryDays: string;
  maxLoginAttempts: string;
  sessionTimeoutMins: string;
  allowRememberMe: string;
}

export function SecuritySettings() {
  const [cfg, setCfg] = useState<SecurityConfig | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => setCfg(d.settings?.security ?? {}));
  }, []);

  if (!cfg) return <Skeleton className="h-64" />;

  function toggle(key: keyof SecurityConfig) {
    setCfg(p => p ? { ...p, [key]: p[key] === "true" ? "false" : "true" } : p);
  }

  return (
    <div className="space-y-4">
      <SettingsSection title="Passwort-Richtlinien" group="security" values={cfg}
        description="Anforderungen an Mitarbeiter-Passwörter">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mindestlänge (Zeichen)</Label>
            <Input type="number" min="6" max="32" value={cfg.passwordMinLength}
              onChange={e => setCfg(p => p ? { ...p, passwordMinLength: e.target.value } : p)} className="w-24" />
          </div>
          <div className="space-y-2">
            <Label>Ablauf nach (Tage, 0 = nie)</Label>
            <Input type="number" min="0" value={cfg.passwordExpiryDays}
              onChange={e => setCfg(p => p ? { ...p, passwordExpiryDays: e.target.value } : p)} className="w-24" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Sonderzeichen Pflicht</p>
            <p className="text-xs text-muted-foreground">Passwort muss Sonderzeichen enthalten</p>
          </div>
          <Switch checked={cfg.passwordRequireSpec === "true"} onCheckedChange={() => toggle("passwordRequireSpec")} />
        </div>
      </SettingsSection>

      <SettingsSection title="Zugangssicherheit" group="security" values={cfg}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Max. Login-Versuche</Label>
            <Input type="number" min="3" max="10" value={cfg.maxLoginAttempts}
              onChange={e => setCfg(p => p ? { ...p, maxLoginAttempts: e.target.value } : p)} className="w-24" />
            <p className="text-xs text-muted-foreground">Danach wird der Account gesperrt</p>
          </div>
          <div className="space-y-2">
            <Label>Session-Timeout (Minuten)</Label>
            <Input type="number" min="30" value={cfg.sessionTimeoutMins}
              onChange={e => setCfg(p => p ? { ...p, sessionTimeoutMins: e.target.value } : p)} className="w-32" />
            <p className="text-xs text-muted-foreground">Nach Inaktivität automatisch abmelden</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">"Angemeldet bleiben" erlauben</p>
            <p className="text-xs text-muted-foreground">Mitarbeiter können sich dauerhaft angemeldet lassen</p>
          </div>
          <Switch checked={cfg.allowRememberMe === "true"} onCheckedChange={() => toggle("allowRememberMe")} />
        </div>
      </SettingsSection>
    </div>
  );
}
```

**Step 3: Commit**
```bash
git add -A && git commit -m "feat: add stamp/geofencing settings and security/password policy UI"
```

---

## Task 6: Settings UI — Benachrichtigungen & SMTP

**Files:**
- Create: `src/components/settings/notification-settings.tsx`

**Step 1: `src/components/settings/notification-settings.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, XCircle } from "lucide-react";

interface NotifyConfig {
  forgotClockout: string;
  lowVacationDays: string;
  overtimeAlertHours: string;
  dailySummaryEnabled: string;
  dailySummaryTime: string;
}

interface SmtpConfig {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFrom: string;
}

export function NotificationSettings() {
  const [notify, setNotify] = useState<NotifyConfig | null>(null);
  const [smtp, setSmtp] = useState<SmtpConfig | null>(null);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => {
        setNotify(d.settings?.notify ?? {});
        setSmtp({
          smtpHost: d.settings?.smtp?.Host ?? "",
          smtpPort: d.settings?.smtp?.Port ?? "587",
          smtpUser: d.settings?.smtp?.User ?? "",
          smtpFrom: d.settings?.smtp?.From ?? "",
        });
      });
  }, []);

  async function testSmtp() {
    setTestStatus("testing");
    // Einfacher Verbindungstest via API
    const res = await fetch("/api/admin/settings/smtp-test", { method: "POST" });
    setTestStatus(res.ok ? "ok" : "error");
    setTimeout(() => setTestStatus("idle"), 4000);
  }

  if (!notify || !smtp) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      {/* SMTP */}
      <SettingsSection title="E-Mail (SMTP)" group="smtp" values={{
        Host: smtp.smtpHost, Port: smtp.smtpPort, User: smtp.smtpUser, From: smtp.smtpFrom
      }} description="Server für ausgehende Benachrichtigungs-E-Mails">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>SMTP-Host</Label>
            <Input placeholder="mail.firma.de" value={smtp.smtpHost}
              onChange={e => setSmtp(p => ({ ...p!, smtpHost: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input type="number" value={smtp.smtpPort}
              onChange={e => setSmtp(p => ({ ...p!, smtpPort: e.target.value }))} className="w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Benutzername</Label>
            <Input value={smtp.smtpUser}
              onChange={e => setSmtp(p => ({ ...p!, smtpUser: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Passwort</Label>
            <Input type="password" placeholder="••••••••" value={smtpPassword}
              onChange={e => setSmtpPassword(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Absender-E-Mail</Label>
          <Input type="email" value={smtp.smtpFrom}
            onChange={e => setSmtp(p => ({ ...p!, smtpFrom: e.target.value }))} />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={testSmtp} disabled={testStatus === "testing"}>
            <Mail className="h-4 w-4 mr-2" />
            {testStatus === "testing" ? "Teste..." : "Verbindung testen"}
          </Button>
          {testStatus === "ok" && <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Verbindung OK</Badge>}
          {testStatus === "error" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Verbindung fehlgeschlagen</Badge>}
        </div>
      </SettingsSection>

      {/* Notification-Trigger */}
      <SettingsSection title="Automatische Benachrichtigungen" group="notify" values={notify}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Vergessenes Ausstempeln</p>
              <p className="text-xs text-muted-foreground">Mitarbeiter werden nach dem Gleitzeitende erinnert</p>
            </div>
            <Switch
              checked={notify.forgotClockout === "true"}
              onCheckedChange={() => setNotify(p => p ? { ...p, forgotClockout: p.forgotClockout === "true" ? "false" : "true" } : p)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Resturlaub-Warnung ab (Tage)</Label>
              <Input type="number" value={notify.lowVacationDays}
                onChange={e => setNotify(p => p ? { ...p, lowVacationDays: e.target.value } : p)} className="w-24" />
              <p className="text-xs text-muted-foreground">HR wird informiert wenn Resturlaub sinkt</p>
            </div>
            <div className="space-y-2">
              <Label>Überstunden-Alert ab (h/Woche)</Label>
              <Input type="number" value={notify.overtimeAlertHours}
                onChange={e => setNotify(p => p ? { ...p, overtimeAlertHours: e.target.value } : p)} className="w-24" />
              <p className="text-xs text-muted-foreground">HR-Notification bei Überschreitung</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tägliche Manager-Zusammenfassung</p>
              <p className="text-xs text-muted-foreground">Manager erhalten täglich eine Übersicht offener Anträge</p>
            </div>
            <Switch
              checked={notify.dailySummaryEnabled === "true"}
              onCheckedChange={() => setNotify(p => p ? { ...p, dailySummaryEnabled: p.dailySummaryEnabled === "true" ? "false" : "true" } : p)}
            />
          </div>
          {notify.dailySummaryEnabled === "true" && (
            <div className="space-y-2">
              <Label>Zusammenfassung um</Label>
              <Input type="time" value={notify.dailySummaryTime}
                onChange={e => setNotify(p => p ? { ...p, dailySummaryTime: e.target.value } : p)} className="w-32" />
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
```

**Step 2: SMTP-Test API**

`src/app/api/admin/settings/smtp-test/route.ts`:
```ts
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canWrite = await hasPermission(session.user.id, "roles", "write");
  if (!canWrite) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true } });

  try {
    await sendEmail({
      to: user?.email ?? "test@firma.de",
      subject: "Zeiterfassung — SMTP-Test",
      text: "Dies ist eine Test-E-Mail um die SMTP-Verbindung zu prüfen.",
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "SMTP-Verbindung fehlgeschlagen" }, { status: 500 });
  }
}
```

**Step 3: Commit**
```bash
git add -A && git commit -m "feat: add notification settings UI with SMTP config and event triggers"
```

---

## Task 7: Settings UI — Feiertage, Branding & Export

**Files:**
- Create: `src/components/settings/holidays-settings.tsx`
- Create: `src/components/settings/branding-settings.tsx`

**Step 1: `src/components/settings/holidays-settings.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";

const STATES = [
  { value: "BW", label: "Baden-Württemberg" },
  { value: "BY", label: "Bayern" },
  { value: "BE", label: "Berlin" },
  { value: "BB", label: "Brandenburg" },
  { value: "HB", label: "Bremen" },
  { value: "HH", label: "Hamburg" },
  { value: "HE", label: "Hessen" },
  { value: "MV", label: "Mecklenburg-Vorpommern" },
  { value: "NI", label: "Niedersachsen" },
  { value: "NW", label: "Nordrhein-Westfalen" },
  { value: "RP", label: "Rheinland-Pfalz" },
  { value: "SL", label: "Saarland" },
  { value: "SN", label: "Sachsen" },
  { value: "ST", label: "Sachsen-Anhalt" },
  { value: "SH", label: "Schleswig-Holstein" },
  { value: "TH", label: "Thüringen" },
];

interface CustomDay { date: string; name: string; }

export function HolidaysSettings() {
  const [state, setState] = useState("NW");
  const [customDays, setCustomDays] = useState<CustomDay[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => {
        setState(d.settings?.holidays?.state ?? "NW");
        try { setCustomDays(JSON.parse(d.settings?.holidays?.customDays ?? "[]")); } catch { /* */ }
      });
  }, []);

  function addDay() {
    if (!newDate || !newName) return;
    setCustomDays(prev => [...prev, { date: newDate, name: newName }]);
    setNewDate(""); setNewName("");
  }

  function removeDay(idx: number) {
    setCustomDays(prev => prev.filter((_, i) => i !== idx));
  }

  const values = { state, customDays: JSON.stringify(customDays) };

  return (
    <div className="space-y-4">
      <SettingsSection title="Feiertage" group="holidays" values={values}
        description="Gesetzliche Feiertage je Bundesland + eigene betriebsfreie Tage">
        <div className="space-y-2">
          <Label>Bundesland</Label>
          <Select value={state} onValueChange={v => setState(v ?? "NW")}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Gesetzliche Feiertage werden automatisch berücksichtigt</p>
        </div>

        <div className="space-y-3">
          <Label>Betriebsfreie Tage (individuell)</Label>
          <div className="flex gap-2">
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-40" />
            <Input placeholder="Bezeichnung (z.B. Betriebsausflug)" value={newName}
              onChange={e => setNewName(e.target.value)} className="flex-1" />
            <Button type="button" size="sm" onClick={addDay} disabled={!newDate || !newName}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {customDays.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs">{d.date}</Badge>
                  <span className="text-sm">{d.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDay(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {customDays.length === 0 && <p className="text-sm text-muted-foreground">Keine eigenen Tage definiert</p>}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
```

**Step 2: `src/components/settings/branding-settings.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface BrandingConfig {
  companyName: string;
  primaryColor: string;
  language: string;
}

interface ExportConfig {
  payrollDay: string;
  csvSeparator: string;
  csvDateFormat: string;
  autoExportEnabled: string;
  autoExportEmail: string;
}

export function BrandingSettings() {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [exportCfg, setExportCfg] = useState<ExportConfig | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => {
        setBranding(d.settings?.branding ?? {});
        setExportCfg(d.settings?.export ?? {});
      });
  }, []);

  if (!branding || !exportCfg) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <SettingsSection title="Unternehmens-Branding" group="branding" values={branding}>
        <div className="space-y-2">
          <Label>Unternehmensname</Label>
          <Input value={branding.companyName}
            onChange={e => setBranding(p => p ? { ...p, companyName: e.target.value } : p)} />
          <p className="text-xs text-muted-foreground">Erscheint in E-Mails und im Seitentitel</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Primärfarbe</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={branding.primaryColor}
                onChange={e => setBranding(p => p ? { ...p, primaryColor: e.target.value } : p)}
                className="w-10 h-10 rounded cursor-pointer border border-border" />
              <Input value={branding.primaryColor}
                onChange={e => setBranding(p => p ? { ...p, primaryColor: e.target.value } : p)}
                className="w-32 font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Systemsprache</Label>
            <Select value={branding.language} onValueChange={v => setBranding(p => p ? { ...p, language: v ?? "de" } : p)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Export & Lohnbuchhaltung" group="export" values={exportCfg}>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Lohnbuchhaltungsstichtag</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min="1" max="31" value={exportCfg.payrollDay}
                onChange={e => setExportCfg(p => p ? { ...p, payrollDay: e.target.value } : p)} className="w-20" />
              <span className="text-sm text-muted-foreground">des Monats</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>CSV-Trennzeichen</Label>
            <Select value={exportCfg.csvSeparator} onValueChange={v => setExportCfg(p => p ? { ...p, csvSeparator: v ?? ";" } : p)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value=";">Semikolon (;)</SelectItem>
                <SelectItem value=",">Komma (,)</SelectItem>
                <SelectItem value="	">Tab</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Datumsformat</Label>
            <Select value={exportCfg.csvDateFormat} onValueChange={v => setExportCfg(p => p ? { ...p, csvDateFormat: v ?? "dd.MM.yyyy" } : p)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dd.MM.yyyy">DD.MM.YYYY</SelectItem>
                <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Automatischer monatlicher Export an</Label>
          <Input type="email" placeholder="lohnbuchhaltung@firma.de" value={exportCfg.autoExportEmail}
            onChange={e => setExportCfg(p => p ? { ...p, autoExportEmail: e.target.value } : p)} />
          <p className="text-xs text-muted-foreground">Leer lassen für keinen automatischen Export</p>
        </div>
      </SettingsSection>
    </div>
  );
}
```

**Step 3: Commit**
```bash
git add -A && git commit -m "feat: add holidays, branding, and export settings UI"
```

---

## Task 8: Einstellungen Hauptseite — 5-Tab Layout

**Files:**
- Modify: `src/app/dashboard/einstellungen/page.tsx`

**Step 1: Einstellungen-Seite komplett ersetzen**

```tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkdaySettings } from "@/components/settings/workday-settings";
import { VacationSettings } from "@/components/settings/vacation-settings";
import { ApprovalSettings } from "@/components/settings/approval-settings";
import { StampSettings } from "@/components/settings/stamp-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { HolidaysSettings } from "@/components/settings/holidays-settings";
import { BrandingSettings } from "@/components/settings/branding-settings";
import { DepartmentManager } from "@/components/admin/department-manager";
import {
  Clock, CalendarDays, CheckSquare, Stamp, Bell, Shield, Building2, Globe,
} from "lucide-react";

export default function EinstellungenPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Systemweite Konfiguration für die gesamte Organisation
        </p>
      </div>

      <Tabs defaultValue="workday" className="space-y-4">
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 h-auto gap-1 p-1">
          <TabsTrigger value="workday" className="flex flex-col gap-1 py-2 h-auto text-xs">
            <Clock className="h-4 w-4" />Arbeitszeit
          </TabsTrigger>
          <TabsTrigger value="vacation" className="flex flex-col gap-1 py-2 h-auto text-xs">
            <CalendarDays className="h-4 w-4" />Urlaub & HO
          </TabsTrigger>
          <TabsTrigger value="approval" className="flex flex-col gap-1 py-2 h-auto text-xs">
            <CheckSquare className="h-4 w-4" />Genehmigung
          </TabsTrigger>
          <TabsTrigger value="stamp" className="flex flex-col gap-1 py-2 h-auto text-xs">
            <Stamp className="h-4 w-4" />Stempel
          </TabsTrigger>
          <TabsTrigger value="notify" className="flex flex-col gap-1 py-2 h-auto text-xs">
            <Bell className="h-4 w-4" />Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex flex-col gap-1 py-2 h-auto text-xs">
            <Shield className="h-4 w-4" />Sicherheit
          </TabsTrigger>
          <TabsTrigger value="system" className="flex flex-col gap-1 py-2 h-auto text-xs">
            <Globe className="h-4 w-4" />System
          </TabsTrigger>
          <TabsTrigger value="org" className="flex flex-col gap-1 py-2 h-auto text-xs">
            <Building2 className="h-4 w-4" />Organisation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workday" className="max-w-2xl">
          <WorkdaySettings />
        </TabsContent>
        <TabsContent value="vacation" className="max-w-2xl">
          <VacationSettings />
        </TabsContent>
        <TabsContent value="approval" className="max-w-2xl">
          <ApprovalSettings />
        </TabsContent>
        <TabsContent value="stamp" className="max-w-2xl">
          <StampSettings />
        </TabsContent>
        <TabsContent value="notify" className="max-w-2xl">
          <NotificationSettings />
        </TabsContent>
        <TabsContent value="security" className="max-w-2xl">
          <SecuritySettings />
        </TabsContent>
        <TabsContent value="system" className="max-w-2xl">
          <div className="space-y-4">
            <HolidaysSettings />
            <BrandingSettings />
          </div>
        </TabsContent>
        <TabsContent value="org" className="max-w-2xl">
          <DepartmentManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 2: shadcn Switch installieren**
```bash
npx shadcn@latest add switch -y
```

**Step 3: Build**
```bash
npm run build
```

**Step 4: Commit**
```bash
git add -A && git commit -m "feat: complete enterprise settings UI with 8-tab layout"
```

---

## Abschluss-Checkliste

- [ ] Alle SystemConfig-Keys in DB (Seed)
- [ ] Settings API (GET grouped / PATCH by group)
- [ ] Tab: Arbeitszeit (ArbZG, Pausen, Gleitzeitrahmen, Auto-Clockout)
- [ ] Tab: Urlaub & HO (Übertrag, Limits, Attest)
- [ ] Tab: Genehmigung (Approver, Eskalation)
- [ ] Tab: Stempel (Mobile, Geofencing, IP-Whitelist)
- [ ] Tab: Notifications (SMTP-Test, Event-Trigger)
- [ ] Tab: Sicherheit (Passwort-Policy, Session)
- [ ] Tab: System (Bundesland, Feiertage, Branding, Export)
- [ ] Tab: Organisation (Abteilungen)
- [ ] `npm run build` ohne Fehler
