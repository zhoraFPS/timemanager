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
    const res = await fetch("/api/admin/settings/smtp-test", { method: "POST" });
    setTestStatus(res.ok ? "ok" : "error");
    setTimeout(() => setTestStatus("idle"), 4000);
  }

  if (!notify || !smtp) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <SettingsSection title="E-Mail (SMTP)" group="smtp" values={{
        Host: smtp.smtpHost, Port: smtp.smtpPort, User: smtp.smtpUser, From: smtp.smtpFrom
      }} description="Server fuer ausgehende Benachrichtigungs-E-Mails">
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
            <Input type="password" placeholder="********" value={smtpPassword}
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
          {testStatus === "ok" && <Badge className="bg-success text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Verbindung OK</Badge>}
          {testStatus === "error" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Verbindung fehlgeschlagen</Badge>}
        </div>
      </SettingsSection>

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
              <Label>Ueberstunden-Alert ab (h/Woche)</Label>
              <Input type="number" value={notify.overtimeAlertHours}
                onChange={e => setNotify(p => p ? { ...p, overtimeAlertHours: e.target.value } : p)} className="w-24" />
              <p className="text-xs text-muted-foreground">HR-Notification bei Ueberschreitung</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Taegliche Manager-Zusammenfassung</p>
              <p className="text-xs text-muted-foreground">Manager erhalten taeglich eine Uebersicht offener Antraege</p>
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
