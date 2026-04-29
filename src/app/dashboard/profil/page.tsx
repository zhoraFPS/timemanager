"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";
import { DeviceList } from "@/components/profil/device-list";

interface PolicyShape {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export default function ProfilPage() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState<PolicyShape | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setTwoFactorEnabled(d.twoFactorEnabled ?? false)).catch(() => {});
    fetch("/api/auth/password-policy").then((r) => r.json()).then(setPolicy).catch(() => {});
  }, []);

  const checks = policy
    ? [
        { ok: newPw.length >= policy.minLength, label: `Mindestens ${policy.minLength} Zeichen` },
        { ok: !policy.requireUpper || /[A-ZÄÖÜ]/.test(newPw), label: "Ein Großbuchstabe" },
        { ok: !policy.requireLower || /[a-zäöüß]/.test(newPw), label: "Ein Kleinbuchstabe" },
        { ok: !policy.requireNumber || /[0-9]/.test(newPw), label: "Eine Ziffer" },
        { ok: !policy.requireSymbol || /[^A-Za-z0-9ÄÖÜäöüß]/.test(newPw), label: "Ein Sonderzeichen" },
      ]
    : [];
  const allShapeOk = checks.every((c) => c.ok);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) { toast.error("Passwörter stimmen nicht überein"); return; }
    if (!allShapeOk) { toast.error("Passwort erfüllt die Richtlinie nicht"); return; }
    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
    });
    if (res.ok) {
      toast.success("Passwort geändert");
      setCurrent(""); setNewPw(""); setConfirm("");
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Fehler");
      if (Array.isArray(d.violations)) {
        d.violations.forEach((v: string) => toast.error(v));
      }
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight">Mein Profil</h1>

      <TwoFactorSetup enabled={twoFactorEnabled} onChanged={() => setTwoFactorEnabled(!twoFactorEnabled)} />

      <DeviceList />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passwort ändern</CardTitle>
          <CardDescription>Richtlinie wird von der Personalabteilung festgelegt</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Aktuelles Passwort</Label>
              <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Neues Passwort</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Passwort bestätigen</Label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>

            {policy && newPw.length > 0 && (
              <ul className="space-y-1 text-xs">
                {checks.map((c) => (
                  <li key={c.label} className={cn("flex items-center gap-2", c.ok ? "text-success" : "text-muted-foreground")}>
                    {c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            )}

            <Button type="submit" className="w-full" disabled={loading || !allShapeOk || newPw !== confirm}>
              {loading ? "Wird geändert..." : "Passwort ändern"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
