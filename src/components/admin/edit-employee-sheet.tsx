"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTRACT_TYPES, type ContractType } from "@/lib/contract-types";
import { RotateCcw, UserX, UserCheck, Copy, Check, IdCard, Clock, Shield, Wrench } from "lucide-react";

interface EmployeeDetail {
  id: string;
  name: string;
  email: string | null;
  employeeNumber: string | null;
  contractType: string;
  isActive: boolean;
  startDate: string | null;
  initialBalance: number;
  departmentId: string | null;
  managerId: string | null;
  deputyId: string | null;
  workingTimeConfig: {
    hoursPerDay: number;
    hoursPerWeek: number;
    vacationDays: number;
    breakMinutes: number;
  } | null;
  roles: { role: { id: string; name: string } }[];
}

interface Props {
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const NONE = "__none__";

interface ManagerOption {
  id: string;
  name: string;
  roleNames: string[];
}

export function EditEmployeeSheet({ userId, onClose, onSaved }: Props) {
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contractType, setContractType] = useState<ContractType>("FULLTIME");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [vacationDays, setVacationDays] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [departmentId, setDepartmentId] = useState(NONE);
  const [managerId, setManagerId] = useState(NONE);
  const [deputyId, setDeputyId] = useState(NONE);
  const [isActive, setIsActive] = useState(true);
  const [allRoles, setAllRoles] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/departments").then(r => r.json()).then(d => setDepartments(d.departments ?? []));
    fetch("/api/admin/users").then(r => r.json()).then(d => {
      type RawUser = { id: string; name: string; roles?: { role: { name: string } }[] };
      const raw = (d.users ?? []) as RawUser[];
      setManagers(raw.map((u) => ({
        id: u.id,
        name: u.name,
        roleNames: (u.roles ?? []).map((r) => r.role.name),
      })));
    });
    fetch("/api/admin/roles").then(r => r.json()).then(d => setAllRoles((d.roles ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))));
  }, []);

  useEffect(() => {
    if (!userId) { setEmployee(null); return; }
    setLoading(true);
    fetch(`/api/admin/users/${userId}`)
      .then(r => r.json())
      .then(d => {
        const u: EmployeeDetail = d.user;
        setEmployee(u);
        setName(u.name);
        setEmail(u.email ?? "");
        setContractType((u.contractType as ContractType) ?? "FULLTIME");
        setHoursPerWeek(String(u.workingTimeConfig?.hoursPerWeek ?? 40));
        setHoursPerDay(String(u.workingTimeConfig?.hoursPerDay ?? 8));
        setVacationDays(String(u.workingTimeConfig?.vacationDays ?? 28));
        setBreakMinutes(String(u.workingTimeConfig?.breakMinutes ?? 30));
        setStartDate(u.startDate ? u.startDate.split("T")[0] : "");
        setInitialBalance(String(u.initialBalance ?? 0));
        setDepartmentId(u.departmentId ?? NONE);
        setManagerId(u.managerId ?? NONE);
        setDeputyId(u.deputyId ?? NONE);
        setIsActive(u.isActive);
        setSelectedRoleIds(u.roles.map(r => r.role.id));
        setLoading(false);
      })
      .catch(() => {
        toast.error("Mitarbeiter konnte nicht geladen werden");
        setLoading(false);
      });
  }, [userId]);

  function applyTemplate(type: ContractType) {
    setContractType(type);
    const t = CONTRACT_TYPES[type];
    setHoursPerWeek(String(t.hoursPerWeek));
    setHoursPerDay(String(t.hoursPerDay));
    setVacationDays(String(t.vacationDays));
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, email,
        contractType, hoursPerDay, hoursPerWeek, vacationDays, breakMinutes,
        startDate: startDate || null,
        initialBalance,
        departmentId: departmentId === NONE ? null : departmentId,
        managerId: managerId === NONE ? null : managerId,
        deputyId: deputyId === NONE ? null : deputyId,
        isActive,
        roleIds: selectedRoleIds,
      }),
    });

    setSaving(false);

    if (res.ok) {
      // Server automatically ensures MANAGER role for anyone assigned as
      // manager/deputy — no client-side prompt needed.
      toast.success("Änderungen gespeichert");
      onSaved();
      onClose();
    } else {
      toast.error("Fehler beim Speichern");
    }
  }

  async function handleResetPassword() {
    if (!userId) return;
    setConfirmReset(false);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    if (!res.ok) {
      toast.error("Passwort-Reset fehlgeschlagen");
      return;
    }
    const data = await res.json();
    if (data.generatedPassword) {
      setNewPassword(data.generatedPassword);
    } else {
      toast.success("Passwort wurde zurückgesetzt");
    }
  }

  async function handleToggleActive() {
    if (!userId) return;
    setConfirmToggle(false);
    const newState = !isActive;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: newState }),
    });
    if (!res.ok) {
      toast.error("Statusänderung fehlgeschlagen");
      return;
    }
    setIsActive(newState);
    toast.success(newState ? "Mitarbeiter aktiviert" : "Mitarbeiter deaktiviert");
    onSaved();
  }

  async function copyPassword() {
    if (!newPassword) return;
    await navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isOpen = !!userId;
  const otherUsers = managers.filter(m => m.id !== userId);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="w-full !max-w-[min(100vw,56rem)] overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {loading ? <Skeleton className="h-5 w-48" /> : employee ? `${employee.name} bearbeiten` : "Mitarbeiter bearbeiten"}
            </SheetTitle>
            {employee && (
              <p className="text-sm text-muted-foreground">
                Nr. {employee.employeeNumber} · {employee.email ?? "keine E-Mail"}
              </p>
            )}
          </SheetHeader>

          {loading && (
            <div className="px-4 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {!loading && employee && (
            <Tabs defaultValue="master" className="flex-1 px-4">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="master" className="gap-1.5"><IdCard className="h-3.5 w-3.5" />Stammdaten</TabsTrigger>
                <TabsTrigger value="time" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Arbeitszeit</TabsTrigger>
                <TabsTrigger value="roles" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Rollen</TabsTrigger>
                <TabsTrigger value="actions" className="gap-1.5"><Wrench className="h-3.5 w-3.5" />Aktionen</TabsTrigger>
              </TabsList>

              <TabsContent value="master" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>E-Mail</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Abteilung</Label>
                    <Select
                      value={departmentId}
                      onValueChange={v => setDepartmentId(v ?? NONE)}
                      items={{ [NONE]: "Keine", ...Object.fromEntries(departments.map(d => [d.id, d.name])) }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                      onValueChange={v => setManagerId(v ?? NONE)}
                      items={{ [NONE]: "Keiner", ...Object.fromEntries(otherUsers.map(m => [m.id, m.name])) }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Keiner</SelectItem>
                        {otherUsers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Stellvertreter</Label>
                  <Select
                    value={deputyId}
                    onValueChange={v => setDeputyId(v ?? NONE)}
                    items={{ [NONE]: "Keiner", ...Object.fromEntries(otherUsers.map(m => [m.id, m.name])) }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Keiner</SelectItem>
                      {otherUsers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Kann bei Abwesenheit des Vorgesetzten Anträge des Teams genehmigen
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Eintrittsdatum</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Anfangssaldo (Stunden)</Label>
                    <Input type="number" step="0.25" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} />
                  </div>
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
                  <p className="text-xs text-muted-foreground">
                    Beim Wechsel werden Standardwerte aus der Vorlage übernommen
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Stunden / Woche</Label>
                    <Input type="number" step="0.5" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Stunden / Tag</Label>
                    <Input type="number" step="0.5" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Urlaubstage / Jahr</Label>
                    <Input type="number" value={vacationDays} onChange={e => setVacationDays(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pause (Min / Tag)</Label>
                    <Input type="number" value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="roles" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Zugewiesene Rollen</Label>
                  <div className="flex flex-wrap gap-2">
                    {allRoles.length > 0 ? allRoles.map(role => {
                      const isSelected = selectedRoleIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            setSelectedRoleIds(prev =>
                              isSelected
                                ? prev.filter(id => id !== role.id)
                                : [...prev, role.id]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          }`}
                        >
                          {role.name}
                        </button>
                      );
                    }) : (
                      <span className="text-sm text-muted-foreground">Keine Rollen verfügbar</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Rollen steuern Berechtigungen. Mindestens eine Rolle empfohlen.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="actions" className="space-y-3 pt-4">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">Passwort zurücksetzen</p>
                      <p className="text-xs text-muted-foreground">
                        Generiert ein neues Zufallspasswort. Mitarbeiter muss es beim nächsten Login ändern.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setConfirmReset(true)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Zurücksetzen
                    </Button>
                  </div>
                </div>
                <div className={`rounded-lg border p-4 space-y-2 ${isActive ? "border-border" : "border-success/40 bg-success/5"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">
                        {isActive ? "Mitarbeiter deaktivieren" : "Mitarbeiter aktivieren"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isActive
                          ? "Der Mitarbeiter kann sich dann nicht mehr einloggen. Daten bleiben erhalten."
                          : "Der Mitarbeiter wird wieder anmeldeberechtigt."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-2 ${isActive ? "text-destructive hover:text-destructive" : "text-success hover:text-success"}`}
                      onClick={() => setConfirmToggle(true)}
                    >
                      {isActive
                        ? <><UserX className="h-3.5 w-3.5" /> Deaktivieren</>
                        : <><UserCheck className="h-3.5 w-3.5" /> Aktivieren</>
                      }
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <SheetFooter className="gap-2 border-t border-border">
            <Button variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? "Wird gespeichert..." : "Änderungen speichern"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reset-Confirm */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Passwort zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Ein neues Zufallspasswort wird generiert. Der Mitarbeiter kann sich mit dem alten Passwort nicht mehr einloggen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>Zurücksetzen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle-Confirm */}
      <AlertDialog open={confirmToggle} onOpenChange={setConfirmToggle}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "Mitarbeiter deaktivieren?" : "Mitarbeiter aktivieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "Der Mitarbeiter kann sich danach nicht mehr einloggen. Zeitdaten und Anträge bleiben erhalten."
                : "Der Mitarbeiter wird wieder anmeldeberechtigt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive}>
              {isActive ? "Deaktivieren" : "Aktivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New-Password Dialog */}
      <Dialog open={!!newPassword} onOpenChange={(o) => { if (!o) setNewPassword(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Passwort</DialogTitle>
            <DialogDescription>
              Kopiere das Passwort und übermittle es dem Mitarbeiter. Es wird nicht noch einmal angezeigt.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/50 p-4 flex items-center justify-between gap-3">
            <code className="font-mono text-base select-all">{newPassword}</code>
            <Button variant="outline" size="sm" className="gap-2" onClick={copyPassword}>
              {copied ? <><Check className="h-3.5 w-3.5" /> Kopiert</> : <><Copy className="h-3.5 w-3.5" /> Kopieren</>}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewPassword(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
