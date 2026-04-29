"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface SurchargeConfig {
  nightEnabled: string;
  nightStart: string;
  nightEnd: string;
  nightPercent: string;
  weekendEnabled: string;
  saturdayPercent: string;
  sundayPercent: string;
  holidayEnabled: string;
  holidayPercent: string;
}

export function SurchargeSettings() {
  const [cfg, setCfg] = useState<SurchargeConfig | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setCfg(d.settings?.surcharge ?? {}));
  }, []);

  function set(key: keyof SurchargeConfig, value: string) {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggle(key: keyof SurchargeConfig) {
    set(key, cfg?.[key] === "true" ? "false" : "true");
  }

  if (!cfg) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Nachtzuschlag"
        group="surcharge"
        values={cfg}
        description="Zuschlag fuer Arbeit in der Nachtzeit (ArbZG §6)"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Nachtzuschlag aktiv</p>
            <p className="text-xs text-muted-foreground">
              Nachtarbeit wird mit Zuschlag berechnet
            </p>
          </div>
          <Switch
            checked={cfg.nightEnabled === "true"}
            onCheckedChange={() => toggle("nightEnabled")}
          />
        </div>
        {cfg.nightEnabled === "true" && (
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label>Nachtzeit von</Label>
              <Input
                type="time"
                value={cfg.nightStart}
                onChange={(e) => set("nightStart", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nachtzeit bis</Label>
              <Input
                type="time"
                value={cfg.nightEnd}
                onChange={(e) => set("nightEnd", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Zuschlag (%)</Label>
              <Input
                type="number"
                min="0"
                max="200"
                value={cfg.nightPercent}
                onChange={(e) => set("nightPercent", e.target.value)}
              />
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Wochenendzuschlag"
        group="surcharge"
        values={cfg}
        description="Zuschlaege fuer Samstags- und Sonntagsarbeit"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Wochenendzuschlag aktiv</p>
            <p className="text-xs text-muted-foreground">
              Samstag und Sonntag erhalten separate Zuschlaege
            </p>
          </div>
          <Switch
            checked={cfg.weekendEnabled === "true"}
            onCheckedChange={() => toggle("weekendEnabled")}
          />
        </div>
        {cfg.weekendEnabled === "true" && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label>Samstag (%)</Label>
              <Input
                type="number"
                min="0"
                max="200"
                value={cfg.saturdayPercent}
                onChange={(e) => set("saturdayPercent", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sonntag (%)</Label>
              <Input
                type="number"
                min="0"
                max="200"
                value={cfg.sundayPercent}
                onChange={(e) => set("sundayPercent", e.target.value)}
              />
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Feiertagszuschlag"
        group="surcharge"
        values={cfg}
        description="Zuschlag fuer Arbeit an gesetzlichen Feiertagen"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Feiertagszuschlag aktiv</p>
            <p className="text-xs text-muted-foreground">
              Feiertage werden anhand der Feiertagseinstellungen ermittelt
            </p>
          </div>
          <Switch
            checked={cfg.holidayEnabled === "true"}
            onCheckedChange={() => toggle("holidayEnabled")}
          />
        </div>
        {cfg.holidayEnabled === "true" && (
          <div className="w-48 space-y-2 pt-2 border-t border-border">
            <Label>Zuschlag (%)</Label>
            <Input
              type="number"
              min="0"
              max="300"
              value={cfg.holidayPercent}
              onChange={(e) => set("holidayPercent", e.target.value)}
            />
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
