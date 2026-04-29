"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { BalanceImportDialog } from "./balance-import-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload } from "lucide-react";

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
  goLiveDate: string;
}

export function WorkdaySettings() {
  const [cfg, setCfg] = useState<WorkdayConfig | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
      <SettingsSection title="Gesetzliche Grenzen (ArbZG)" group="workday" values={cfg}
        description="Maximale Arbeitszeiten gemaess Arbeitszeitgesetz">
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

      <SettingsSection title="Gleitzeitrahmen" group="workday" values={cfg}
        description="Erlaubter Zeitraum fuer Ein- und Ausstempeln">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Frueheste Einstempelzeit</Label>
            <Input type="time" value={cfg.flexiStart} onChange={e => set("flexiStart", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Spaeteste Ausstempelzeit</Label>
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

      <SettingsSection title="Go-Live / Migration" group="workday" values={cfg}
        description="Einmalige Einrichtung beim Start oder Umstieg aus einem anderen System.">
        <div className="space-y-2">
          <Label>Go-Live-Datum</Label>
          <Input
            type="date"
            value={cfg.goLiveDate ?? ""}
            onChange={e => set("goLiveDate", e.target.value)}
            className="w-48"
          />
          <p className="text-xs text-muted-foreground">
            Alle Gleitzeit-Berechnungen starten ab diesem Datum. Leer lassen fuer kein Cutoff.
            Bei Go-Live heutiges Datum eintragen &rarr; alle Salden starten bei 0 (plus Anfangssaldo).
          </p>
        </div>
        <div className="space-y-2 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Plus-/Minusstunden aus Atoss uebernehmen</p>
              <p className="text-xs text-muted-foreground">
                CSV-Import der Salden als Anfangssaldo pro Mitarbeiter. Jeder Import wird im Audit-Log protokolliert.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" /> Salden importieren
            </Button>
          </div>
        </div>
      </SettingsSection>

      <BalanceImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

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
