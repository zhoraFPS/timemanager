"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

const STAMP_TYPES = [
  { key: "WORK", label: "Kommen (Regelarbeitszeit)" },
  { key: "MOBILE_WORK", label: "Mobiles Arbeiten" },
  { key: "HOME_GAME", label: "Heimspiel" },
  { key: "AWAY_GAME", label: "Auswartsspiel" },
  { key: "BUSINESS_TRIP", label: "Dienstreise" },
  { key: "TRAINING", label: "Fortbildung" },
  { key: "VOLUNTEERING", label: "Corp. Volunteering" },
  { key: "OVERTIME", label: "Ueberstunden-Zuschlag" },
];

const ABSENCE_TYPES = [
  { key: "VACATION", label: "Urlaub" },
  { key: "SICK", label: "Krank" },
  { key: "SPECIAL_LEAVE", label: "Sonderurlaub" },
];

interface DatevConfig {
  mandantennr: string;
  beraternr: string;
  wirtschaftsjahr: string;
  lodasVersion: string;
  [key: string]: string;
}

export function DatevSettings() {
  const [cfg, setCfg] = useState<DatevConfig | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setCfg(d.settings?.datev ?? {}));
  }, []);

  function set(key: string, value: string) {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (!cfg) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <SettingsSection
        title="DATEV Mandant"
        group="datev"
        values={cfg}
        description="Zugangsdaten fuer den DATEV LODAS-Export"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mandantennummer</Label>
            <Input
              value={cfg.mandantennr ?? ""}
              onChange={(e) => set("mandantennr", e.target.value)}
              placeholder="z.B. 12345"
            />
          </div>
          <div className="space-y-2">
            <Label>Beraternummer</Label>
            <Input
              value={cfg.beraternr ?? ""}
              onChange={(e) => set("beraternr", e.target.value)}
              placeholder="z.B. 1001"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Wirtschaftsjahr</Label>
            <Input
              value={cfg.wirtschaftsjahr ?? ""}
              onChange={(e) => set("wirtschaftsjahr", e.target.value)}
              placeholder="2026"
            />
          </div>
          <div className="space-y-2">
            <Label>LODAS-Version</Label>
            <Input
              value={cfg.lodasVersion ?? ""}
              onChange={(e) => set("lodasVersion", e.target.value)}
              placeholder="12.0"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Lohnarten-Zuordnung"
        group="datev"
        values={cfg}
        description="Zuordnung der Stempelarten zu DATEV-Lohnart-Nummern"
      >
        <div className="space-y-3">
          {STAMP_TYPES.map((t) => (
            <div key={t.key} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{t.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs shrink-0">
                  Lohnart
                </Badge>
                <Input
                  value={cfg[`lohnart.${t.key}`] ?? ""}
                  onChange={(e) => set(`lohnart.${t.key}`, e.target.value)}
                  className="w-24 font-mono text-center"
                  placeholder="Nr."
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Die Lohnart-Nummern muessen mit der DATEV LODAS-Konfiguration Ihres
          Steuerberaters uebereinstimmen.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Fehlzeiten-Schluessel"
        group="datev"
        values={cfg}
        description="DATEV-Abwesenheitsschluessel fuer Fehlzeiten-Export"
      >
        <div className="space-y-3">
          {ABSENCE_TYPES.map((t) => (
            <div key={t.key} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{t.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs shrink-0">
                  Schluessel
                </Badge>
                <Input
                  value={cfg[`absence.${t.key}`] ?? ""}
                  onChange={(e) => set(`absence.${t.key}`, e.target.value)}
                  className="w-24 font-mono text-center"
                  placeholder="z.B. U"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Standard-Schluessel: U = Urlaub, K = Krank, SU = Sonderurlaub
        </p>
      </SettingsSection>

      <SettingsSection
        title="DATEV-Produktanbindung"
        group="datev"
        values={cfg}
        description="Unterstuetzte DATEV-Produkte und Schnittstellen"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-success/10 text-success">Aktiv</Badge>
            <span className="text-sm">DATEV LODAS — Bewegungsdaten-Import (CSV)</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-success/10 text-success">Aktiv</Badge>
            <span className="text-sm">DATEV Lohn und Gehalt — Monatliche Abrechnung (CSV)</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-success/10 text-success">Aktiv</Badge>
            <span className="text-sm">DATEV Kostenrechnung classic — IBL-Bewegungssaetze (ASCII)</span>
          </div>
        </div>
      </SettingsSection>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>eAU — Elektronische Arbeitsunfaehigkeitsbescheinigung</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p className="text-sm">
            Die eAU-Anbindung ueber den DATEV Lohnaustauschdatenservice ist vorbereitet.
            Fuer die Aktivierung wird ein DATEV-Partnerzugang benoetigt.
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">Geplant</Badge>
            <span className="text-sm text-muted-foreground">
              Automatischer Abruf von Krankmeldungen via DATEV Lohnaustauschdatenservice
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">Geplant</Badge>
            <span className="text-sm text-muted-foreground">
              Automatische Uebernahme in Fehlzeiten-Verwaltung
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Kontaktieren Sie Ihren DATEV-Berater fuer die Freischaltung des Lohnaustauschdatenservice.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
