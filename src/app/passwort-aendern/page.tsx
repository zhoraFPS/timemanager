"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PolicyShape {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export default function PasswortAendernPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState<PolicyShape | null>(null);

  useEffect(() => {
    fetch("/api/auth/password-policy")
      .then((r) => r.json())
      .then(setPolicy)
      .catch(() => setPolicy(null));
  }, []);

  const checks = policy
    ? [
        { ok: newPassword.length >= policy.minLength, label: `Mindestens ${policy.minLength} Zeichen` },
        { ok: !policy.requireUpper || /[A-ZÄÖÜ]/.test(newPassword), label: "Ein Großbuchstabe" },
        { ok: !policy.requireLower || /[a-zäöüß]/.test(newPassword), label: "Ein Kleinbuchstabe" },
        { ok: !policy.requireNumber || /[0-9]/.test(newPassword), label: "Eine Ziffer" },
        { ok: !policy.requireSymbol || /[^A-Za-z0-9ÄÖÜäöüß]/.test(newPassword), label: "Ein Sonderzeichen" },
      ]
    : [];

  const allShapeOk = checks.every((c) => c.ok);
  const match = newPassword.length > 0 && newPassword === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setViolations([]);
    if (newPassword !== confirm) { setError("Passwörter stimmen nicht überein"); return; }
    if (!allShapeOk) { setError("Passwort erfüllt die Richtlinie nicht"); return; }

    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    if (res.ok) {
      await signOut({ redirect: false });
      router.push("/login");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Fehler");
    if (Array.isArray(data.violations)) setViolations(data.violations);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
          <CardDescription>Bitte lege ein neues Passwort fest.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Neues Passwort</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Passwort bestätigen</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {confirm.length > 0 && (
                <p className={cn("text-xs", match ? "text-success" : "text-destructive")}>
                  {match ? "Passwörter stimmen überein" : "Passwörter stimmen nicht überein"}
                </p>
              )}
            </div>

            {policy && (
              <ul className="space-y-1 text-xs">
                {checks.map((c) => (
                  <li key={c.label} className={cn("flex items-center gap-2", c.ok ? "text-success" : "text-muted-foreground")}>
                    {c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <div className="text-sm text-destructive space-y-1">
                <p>{error}</p>
                {violations.length > 0 && (
                  <ul className="list-disc pl-4">
                    {violations.map((v) => <li key={v}>{v}</li>)}
                  </ul>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || !allShapeOk || !match}>
              {loading ? "Wird gespeichert..." : "Passwort setzen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
