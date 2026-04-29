"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface SecurityConfig {
  passwordMinLength: string;
  passwordRequireSpec: string;
  passwordExpiryDays: string;
  maxLoginAttempts: string;
  sessionTimeoutMins: string;
  allowRememberMe: string;
  twoFactorEnforced: string;
  ssoEnabled: string;
  ssoProvider: string;
  ssoClientId: string;
  ssoIssuerUrl: string;
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
        description="Anforderungen an Mitarbeiter-Passwoerter">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mindestlaenge (Zeichen)</Label>
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
            <p className="text-xs text-muted-foreground">Nach Inaktivitaet automatisch abmelden</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">"Angemeldet bleiben" erlauben</p>
            <p className="text-xs text-muted-foreground">Mitarbeiter koennen sich dauerhaft angemeldet lassen</p>
          </div>
          <Switch checked={cfg.allowRememberMe === "true"} onCheckedChange={() => toggle("allowRememberMe")} />
        </div>
      </SettingsSection>
      <SettingsSection title="Zwei-Faktor-Authentifizierung" group="security" values={cfg}
        description="TOTP-basierte 2FA fuer alle oder ausgewaehlte Mitarbeiter">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">2FA Pflicht</p>
            <p className="text-xs text-muted-foreground">Alle Mitarbeiter muessen 2FA aktivieren</p>
          </div>
          <Switch checked={cfg.twoFactorEnforced === "true"} onCheckedChange={() => toggle("twoFactorEnforced")} />
        </div>
      </SettingsSection>

      <SettingsSection title="Single Sign-On (SSO)" group="security" values={cfg}
        description="OIDC/SAML-Anbindung an Unternehmens-Identity-Provider">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">SSO aktiviert</p>
            <p className="text-xs text-muted-foreground">Login ueber externen Identity Provider</p>
          </div>
          <Switch checked={cfg.ssoEnabled === "true"} onCheckedChange={() => toggle("ssoEnabled")} />
        </div>
        {cfg.ssoEnabled === "true" && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input value={cfg.ssoProvider}
                onChange={e => setCfg(p => p ? { ...p, ssoProvider: e.target.value } : p)}
                placeholder="z.B. Microsoft Entra ID, Okta, Google Workspace" />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input value={cfg.ssoClientId}
                onChange={e => setCfg(p => p ? { ...p, ssoClientId: e.target.value } : p)}
                placeholder="OAuth2 Client ID" className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Issuer URL</Label>
              <Input value={cfg.ssoIssuerUrl}
                onChange={e => setCfg(p => p ? { ...p, ssoIssuerUrl: e.target.value } : p)}
                placeholder="https://login.microsoftonline.com/..." className="font-mono text-sm" />
            </div>
            <p className="text-xs text-muted-foreground">
              SSO-Integration wird nach Eingabe der Konfiguration vom Administrator freigeschaltet.
              Unterstuetzt werden OIDC-kompatible Provider (Microsoft Entra, Okta, Google, Keycloak).
            </p>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
