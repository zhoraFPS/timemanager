"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, MapPin, Wifi } from "lucide-react";

interface StampConfig {
  mobileAllowed: string;
  directCorrectionDays: string;
  maxCorrectionDays: string;
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
            <p className="text-xs text-muted-foreground">Mitarbeiter koennen per Smartphone stempeln</p>
          </div>
          <Switch checked={cfg.mobileAllowed === "true"} onCheckedChange={() => toggle("mobileAllowed")} />
        </div>
      </SettingsSection>

      <SettingsSection title="Zeitkorrektur-Richtlinie" group="stamp" values={cfg}
        description="Legt fest, wie lange Mitarbeiter Stempelungen selbst korrigieren duerfen">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Direkte Korrektur (ohne Antrag)</p>
            <p className="text-xs text-muted-foreground">
              Mitarbeiter koennen Eintraege innerhalb dieser Frist selbst aendern
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={30}
              value={cfg.directCorrectionDays ?? "3"}
              onChange={e => setCfg(p => p ? { ...p, directCorrectionDays: e.target.value } : p)}
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">Tage</span>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-border/40">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Obergrenze fuer HR-Korrekturantraege</p>
            <p className="text-xs text-muted-foreground">
              Nach der direkten Frist geht die Korrektur als Antrag an HR. 0 = unbegrenzt (nur Monatsabschluss stoppt).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={365}
              value={cfg.maxCorrectionDays ?? "0"}
              onChange={e => setCfg(p => p ? { ...p, maxCorrectionDays: e.target.value } : p)}
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">Tage</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
          Vertrauensarbeitszeit: innerhalb der direkten Frist ändert der Mitarbeiter selbst (ohne Antrag). Nach dieser Frist geht die Korrektur automatisch als Antrag an HR — kein Vorgesetztenweg.
        </p>
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
                <Label>Laengengrad (Longitude)</Label>
                <Input placeholder="z.B. 7.4653" value={cfg.geofencingLng}
                  onChange={e => setCfg(p => p ? { ...p, geofencingLng: e.target.value } : p)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              GPS-Koordinaten des Hauptarbeitsorts (Stadion/Buero)
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
              <p className="text-sm font-medium">IP-Einschraenkung aktiv</p>
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
