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
            <Label>Primaerfarbe</Label>
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
          <p className="text-xs text-muted-foreground">Leer lassen fuer keinen automatischen Export</p>
        </div>
      </SettingsSection>
    </div>
  );
}
