"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTRACT_TYPES, type ContractType } from "@/lib/contract-types";
import { IdCard, Clock, Shield, Copy, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const NONE = "__none__";

export function CreateEmployeeSheet({ open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState(NONE);
  const [managerId, setManagerId] = useState(NONE);
  const [startDate, setStartDate] = useState("");

  const [contractType, setContractType] = useState<ContractType>("FULLTIME");
  const [hoursPerWeek, setHoursPerWeek] = useState("40");
  const [hoursPerDay, setHoursPerDay] = useState("8");
  const [vacationDays, setVacationDays] = useState("28");
  const [breakMinutes, setBreakMinutes] = useState("30");
  const [initialBalance, setInitialBalance] = useState("0");

  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [roleId, setRoleId] = useState(NONE);

  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/users/next-employee-number").then(r => r.json()).then(d => setEmployeeNumber(d.next ?? "1001"));
    fetch("/api/admin/departments").then(r => r.json()).then(d => setDepartments(d.departments ?? []));
    fetch("/api/admin/users").then(r => r.json()).then(d => setManagers(d.users ?? []));
    fetch("/api/admin/roles").then(r => r.json()).then(d => setRoles(d.roles ?? []));
  }, [open]);

  function reset() {
    setFirstName(""); setLastName(""); setEmail("");
    setDepartmentId(NONE); setManagerId(NONE); setStartDate("");
    setContractType("FULLTIME");
    setHoursPerWeek("40"); setHoursPerDay("8");
    setVacationDays("28"); setBreakMinutes("30");
    setInitialBalance("0"); setRoleId(NONE);
    setMustChangePassword(true);
  }

  function applyTemplate(type: ContractType) {
    setContractType(type);
    const t = CONTRACT_TYPES[type];
    setHoursPerWeek(String(t.hoursPerWeek));
    setHoursPerDay(String(t.hoursPerDay));
    setVacationDays(String(t.vacationDays));
  }

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim() || !employeeNumber.trim()) {
      toast.error("Vor-/Nachname und Mitarbeiternummer sind Pflichtfelder");
      return;
    }
    setLoading(true);

    // Generate initial password on the client, send to the server. The server
    // immediately hashes it; we show it once in a follow-up dialog so the
    // admin can hand it over.
    const generatedPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim() || undefined,
        password: generatedPassword,
        employeeNumber: employeeNumber.trim(),
        departmentId: departmentId === NONE ? undefined : departmentId,
        managerId: managerId === NONE ? undefined : managerId,
        contractType,
        hoursPerDay: parseFloat(hoursPerDay),
        hoursPerWeek: parseFloat(hoursPerWeek),
        vacationDays: parseInt(vacationDays),
        breakMinutes: parseInt(breakMinutes),
        startDate: startDate || undefined,
        initialBalance: parseFloat(initialBalance),
        mustChangePassword,
        roleId: roleId === NONE ? undefined : roleId,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Fehler beim Anlegen");
      return;
    }

    const data = await res.json();
    setNewPassword(generatedPassword);
    setNewName(data.user.name);
    setNewNumber(data.user.employeeNumber ?? "");
    onSuccess();
  }

  async function copyPassword() {
    if (!newPassword) return;
    await navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeAll() {
    setNewPassword(null);
    reset();
    onClose();
  }

  return (
    <>
      <Sheet open={open && !newPassword} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full !max-w-[min(100vw,56rem)] overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle>Neuen Mitarbeiter anlegen</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Standardwerte aus der Vertragsart werden automatisch vorausgefüllt.
            </p>
          </SheetHeader>

          <Tabs defaultValue="master" className="flex-1 px-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="master" className="gap-1.5"><IdCard className="h-3.5 w-3.5" />Stammdaten</TabsTrigger>
              <TabsTrigger value="time" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Arbeitszeit</TabsTrigger>
              <TabsTrigger value="access" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Zugang</TabsTrigger>
            </TabsList>

            <TabsContent value="master" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Vorname *</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Nachname *</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Mitarbeiternummer *</Label><Input value={employeeNumber} onChange={e => setEmployeeNumber(e.target.value)} /></div>
                <div className="space-y-2"><Label>E-Mail</Label><Input type="email" placeholder="optional" value={email} onChange={e => setEmail(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Abteilung</Label>
                  <Select
                    value={departmentId}
                    onValueChange={(v) => setDepartmentId(v ?? NONE)}
                    items={{ [NONE]: "Keine", ...Object.fromEntries(departments.map(d => [d.id, d.name])) }}
                  >
                    <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Keine</SelectItem>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vorgesetzter</Label>
                  <Select
                    value={managerId}
                    onValueChange={(v) => setManagerId(v ?? NONE)}
                    items={{ [NONE]: "Keiner", ...Object.fromEntries(managers.map(m => [m.id, m.name])) }}
                  >
                    <SelectTrigger><SelectValue placeholder="Keiner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Keiner</SelectItem>
                      {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Eintrittsdatum</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="time" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Vertragsart</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(CONTRACT_TYPES) as [ContractType, (typeof CONTRACT_TYPES)[ContractType]][]).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyTemplate(key)}
                      className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                        contractType === key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Stunden / Woche</Label><Input type="number" step="0.5" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)} /></div>
                <div className="space-y-2"><Label>Stunden / Tag</Label><Input type="number" step="0.5" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Urlaubstage / Jahr</Label><Input type="number" value={vacationDays} onChange={e => setVacationDays(e.target.value)} /></div>
                <div className="space-y-2"><Label>Pause (Min / Tag)</Label><Input type="number" value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Anfangssaldo (Stunden)</Label><Input type="number" step="0.25" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} /></div>
            </TabsContent>

            <TabsContent value="access" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Rolle</Label>
                <Select
                  value={roleId}
                  onValueChange={(v) => setRoleId(v ?? NONE)}
                  items={{ [NONE]: "Keine Rolle", ...Object.fromEntries(roles.map(r => [r.id, r.name])) }}
                >
                  <SelectTrigger><SelectValue placeholder="Keine Rolle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Keine Rolle</SelectItem>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Steuert die Berechtigungen. Kann später in den Rollen-Einstellungen angepasst werden.
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium">Passwort</p>
                <p className="text-xs text-muted-foreground">
                  Wird automatisch generiert und nach dem Anlegen einmalig angezeigt.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mustChangePassword}
                    onChange={e => setMustChangePassword(e.target.checked)}
                    className="rounded"
                  />
                  Beim ersten Login Passwort ändern lassen
                </label>
              </div>
            </TabsContent>
          </Tabs>

          <SheetFooter className="gap-2 border-t border-border">
            <Button variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Wird angelegt..." : "Anlegen"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!newPassword} onOpenChange={(o) => { if (!o) closeAll(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newName} wurde angelegt</DialogTitle>
            <DialogDescription>
              Mitarbeiternummer <span className="font-mono font-medium">{newNumber}</span>.
              Kopiere das Passwort und übermittle es dem Mitarbeiter — es wird nicht erneut angezeigt.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/50 p-4 flex items-center justify-between gap-3">
            <code className="font-mono text-base select-all">{newPassword}</code>
            <Button variant="outline" size="sm" className="gap-2" onClick={copyPassword}>
              {copied ? <><Check className="h-3.5 w-3.5" /> Kopiert</> : <><Copy className="h-3.5 w-3.5" /> Kopieren</>}
            </Button>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeAll}>Schließen</Button>
            <Button onClick={() => { setNewPassword(null); reset(); }}>Weiteren anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
