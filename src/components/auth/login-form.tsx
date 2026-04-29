"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ERROR_MESSAGES: Record<string, string> = {
  NotAuthorized:
    "Dein Microsoft-Konto ist nicht fuer VfL Zeitspiel freigegeben. Bitte an die Personalabteilung wenden.",
  OAuthAccountNotLinked:
    "E-Mail bereits mit einem anderen Login verknuepft. Bitte Support kontaktieren.",
  Configuration: "SSO-Konfiguration fehlerhaft. Bitte Administrator informieren.",
  AccessDenied: "Zugriff abgelehnt.",
};

export function LoginForm({
  entraEnabled = false,
  initialError,
}: {
  entraEnabled?: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    initialError ? ERROR_MESSAGES[initialError] ?? "Anmeldung fehlgeschlagen." : null
  );
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      employeeNumber: form.get("employeeNumber"),
      password: form.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Mitarbeiternummer oder Passwort falsch.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleEntraSignIn() {
    setSsoLoading(true);
    await signIn("microsoft-entra-id", { callbackUrl: "/dashboard" });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>VfL Zeitspiel</CardTitle>
        <CardDescription>Mit deinem Firmen-Account anmelden</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {entraEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleEntraSignIn}
              disabled={ssoLoading || loading}
            >
              {ssoLoading ? "Weiterleitung..." : "Mit Microsoft anmelden"}
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">oder</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employeeNumber">Mitarbeiternummer</Label>
            <Input
              id="employeeNumber"
              name="employeeNumber"
              type="text"
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={loading || ssoLoading}>
            {loading ? "Anmelden..." : "Anmelden"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
