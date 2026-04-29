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
            <Label>Urlaubsantraege genehmigt durch</Label>
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
            <p className="text-xs text-muted-foreground">Manager + HR muessen zustimmen</p>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
