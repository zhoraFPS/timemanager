"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";

interface Props {
  enabled: boolean;
  onChanged?: () => void;
}

export function TwoFactorSetup({ enabled, onChanged }: Props) {
  const [is2FA, setIs2FA] = useState(enabled);
  const [step, setStep] = useState<"idle" | "setup" | "verify">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startSetup() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/two-factor");
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("verify");
    } else {
      setError(data.error ?? "Fehler");
    }
  }

  async function verifyCode() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/two-factor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setIs2FA(true);
      setStep("idle");
      setCode("");
      onChanged?.();
    } else {
      setError(data.error ?? "Ungueltiger Code");
    }
  }

  async function disable2FA() {
    setLoading(true);
    const res = await fetch("/api/auth/two-factor", { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      setIs2FA(false);
      onChanged?.();
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Zwei-Faktor-Authentifizierung</CardTitle>
            <CardDescription className="mt-1">
              Schuetze dein Konto mit einem TOTP-Authenticator (z.B. Google Authenticator, Authy)
            </CardDescription>
          </div>
          {is2FA ? (
            <Badge className="bg-success text-white"><ShieldCheck className="h-3 w-3 mr-1" />Aktiv</Badge>
          ) : (
            <Badge variant="outline"><ShieldOff className="h-3 w-3 mr-1" />Inaktiv</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "idle" && !is2FA && (
          <Button onClick={startSetup} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            2FA aktivieren
          </Button>
        )}

        {step === "idle" && is2FA && (
          <Button variant="destructive" onClick={disable2FA} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            2FA deaktivieren
          </Button>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scanne den QR-Code mit deiner Authenticator-App und gib den 6-stelligen Code ein.
            </p>
            {qrCode && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-md" />
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Manueller Schluessel:</p>
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{secret}</code>
            </div>
            <div className="space-y-2 max-w-xs mx-auto">
              <Label>Verifizierungscode</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-lg font-mono tracking-widest"
                maxLength={6}
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <div className="flex gap-2 justify-center">
              <Button onClick={verifyCode} disabled={code.length !== 6 || loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verifizieren & Aktivieren
              </Button>
              <Button variant="ghost" onClick={() => { setStep("idle"); setCode(""); setError(""); }}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
