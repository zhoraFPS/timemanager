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
        description="Regeln fuer Urlaubsanspruch und -planung">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Resturlaub-Uebertrag erlaubt</p>
            <p className="text-xs text-muted-foreground">Nicht genutzter Urlaub wird ins Folgejahr uebertragen</p>
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
              <p className="text-xs text-muted-foreground">Monat (1=Jan, 3=Maerz)</p>
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
            <Label>Max. Urlaubstage am Stueck</Label>
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
            <p className="text-xs text-muted-foreground">Mitarbeiter muessen HO-Tage beantragen</p>
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
