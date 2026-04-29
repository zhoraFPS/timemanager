"use client";

import { useState, useEffect } from "react";
import { SettingsSection } from "./settings-section";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";

const STATES = [
  { value: "BW", label: "Baden-Wuerttemberg" },
  { value: "BY", label: "Bayern" },
  { value: "BE", label: "Berlin" },
  { value: "BB", label: "Brandenburg" },
  { value: "HB", label: "Bremen" },
  { value: "HH", label: "Hamburg" },
  { value: "HE", label: "Hessen" },
  { value: "MV", label: "Mecklenburg-Vorpommern" },
  { value: "NI", label: "Niedersachsen" },
  { value: "NW", label: "Nordrhein-Westfalen" },
  { value: "RP", label: "Rheinland-Pfalz" },
  { value: "SL", label: "Saarland" },
  { value: "SN", label: "Sachsen" },
  { value: "ST", label: "Sachsen-Anhalt" },
  { value: "SH", label: "Schleswig-Holstein" },
  { value: "TH", label: "Thueringen" },
];

interface CustomDay { date: string; name: string; }

export function HolidaysSettings() {
  const [state, setState] = useState("NW");
  const [customDays, setCustomDays] = useState<CustomDay[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => {
        setState(d.settings?.holidays?.state ?? "NW");
        try { setCustomDays(JSON.parse(d.settings?.holidays?.customDays ?? "[]")); } catch { /* */ }
        setLoading(false);
      });
  }, []);

  function addDay() {
    if (!newDate || !newName) return;
    setCustomDays(prev => [...prev, { date: newDate, name: newName }]);
    setNewDate(""); setNewName("");
  }

  function removeDay(idx: number) {
    setCustomDays(prev => prev.filter((_, i) => i !== idx));
  }

  if (loading) return <Skeleton className="h-64" />;

  const values = { state, customDays: JSON.stringify(customDays) };

  return (
    <div className="space-y-4">
      <SettingsSection title="Feiertage" group="holidays" values={values}
        description="Gesetzliche Feiertage je Bundesland + eigene betriebsfreie Tage">
        <div className="space-y-2">
          <Label>Bundesland</Label>
          <Select value={state} onValueChange={v => setState(v ?? "NW")}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Gesetzliche Feiertage werden automatisch beruecksichtigt</p>
        </div>

        <div className="space-y-3">
          <Label>Betriebsfreie Tage (individuell)</Label>
          <div className="flex gap-2">
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-40" />
            <Input placeholder="Bezeichnung (z.B. Betriebsausflug)" value={newName}
              onChange={e => setNewName(e.target.value)} className="flex-1" />
            <Button type="button" size="sm" onClick={addDay} disabled={!newDate || !newName}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {customDays.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs">{d.date}</Badge>
                  <span className="text-sm">{d.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDay(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {customDays.length === 0 && <p className="text-sm text-muted-foreground">Keine eigenen Tage definiert</p>}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
