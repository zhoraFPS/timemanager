"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  group: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: Record<string, any>;
  onSaved?: () => void;
  children: React.ReactNode;
}

export function SettingsSection({ title, description, group, values, onSaved, children }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/settings/${group}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } else {
      const d = await res.json();
      setError(d.error ?? "Fehler");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="shrink-0">
            {saved ? <><Check className="h-3.5 w-3.5 mr-1" />Gespeichert</> :
             saving ? "Speichern..." :
             <><Save className="h-3.5 w-3.5 mr-1" />Speichern</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
