"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Download, FileSpreadsheet, Users, CalendarX, Building2, Calculator, Info,
} from "lucide-react";

const MONTHS = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.click();
}

export function DatevExport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState((now.getMonth() + 1).toString());

  const params = `?year=${year}&month=${month}`;

  return (
    <div className="space-y-4">
      {/* Month/Year Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abrechnungszeitraum</CardTitle>
          <CardDescription>
            Waehlen Sie den Monat fuer den DATEV-Export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select value={month} onValueChange={(v) => v && setMonth(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={(v) => v && setYear(v)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* LODAS Exports */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          DATEV LODAS
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Bewegungsdaten</CardTitle>
                <Badge variant="outline" className="font-mono text-xs">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Stunden pro Eintrag mit Lohnart-Zuordnung fuer LODAS-Import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                onClick={() => downloadFile(`/api/reports/datev-bewegung${params}`)}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportieren
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Personalstammdaten</CardTitle>
                <Badge variant="outline" className="font-mono text-xs">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Mitarbeiterdaten fuer Stammdatenabgleich
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                onClick={() => downloadFile("/api/reports/datev-stammdaten")}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportieren
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Fehlzeiten</CardTitle>
                <Badge variant="outline" className="font-mono text-xs">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Genehmigte Abwesenheiten mit Fehlzeitenschluessel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                onClick={() => downloadFile(`/api/reports/datev-fehlzeiten${params}`)}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportieren
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lohn und Gehalt + Kostenrechnung */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          DATEV Lohn und Gehalt / Kostenrechnung
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  Lohn und Gehalt
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Monatlich aggregierte Stunden pro Mitarbeiter und Lohnart
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                onClick={() => downloadFile(`/api/reports/datev-lug${params}`)}
              >
                <Download className="h-4 w-4 mr-2" />
                LuG-Export
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  IBL-Bewegungssaetze
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">ASCII</Badge>
              </div>
              <CardDescription className="text-xs">
                Kostenstellenzuordnung fuer DATEV Kostenrechnung classic
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                onClick={() => downloadFile(`/api/reports/datev-ibl${params}`)}
              >
                <Download className="h-4 w-4 mr-2" />
                IBL-Export
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* eAU Placeholder */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>eAU — Elektronische Arbeitsunfaehigkeitsbescheinigung</AlertTitle>
        <AlertDescription className="text-xs mt-1">
          Die eAU-Anbindung ueber den DATEV Lohnaustauschdatenservice ist vorbereitet.
          Nach Freischaltung des DATEV-Partnerzugangs werden Krankmeldungen automatisch
          abgerufen und in die Fehlzeiten-Verwaltung uebernommen.
        </AlertDescription>
      </Alert>

      <p className="text-xs text-muted-foreground">
        Alle Exports verwenden die Mandantennummer, Lohnarten-Zuordnung und Fehlzeiten-Schluessel
        aus den DATEV-Einstellungen. Konfiguration unter Einstellungen → DATEV.
      </p>
    </div>
  );
}
