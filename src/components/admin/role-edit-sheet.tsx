"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Lock } from "lucide-react";
import {
  RESOURCES, ACTIONS, SCOPES,
  RESOURCE_ACTIONS, RESOURCE_LABELS, ACTION_LABELS, SCOPE_LABELS,
  type Resource, type Action, type Scope,
} from "@/lib/rbac";

interface RolePermission {
  id?: string;
  resource: string;
  action: string;
  scope: string;
}

interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: RolePermission[];
  _count?: { users: number };
}

interface Props {
  role: RoleDetail | null;
  mode: "create" | "edit" | null;
  onClose: () => void;
  onSaved: () => void;
}

type Matrix = Record<Resource, Record<Action, Scope | null>>;

function emptyMatrix(): Matrix {
  const m = {} as Matrix;
  for (const r of RESOURCES) {
    m[r] = {} as Record<Action, Scope | null>;
    for (const a of ACTIONS) m[r][a] = null;
  }
  return m;
}

function toMatrix(perms: RolePermission[]): Matrix {
  const m = emptyMatrix();
  for (const p of perms) {
    const r = p.resource as Resource;
    const a = p.action as Action;
    const s = p.scope as Scope;
    if (!RESOURCES.includes(r) || !ACTIONS.includes(a) || !SCOPES.includes(s)) continue;
    m[r][a] = s;
  }
  return m;
}

function toPermissions(m: Matrix): RolePermission[] {
  const out: RolePermission[] = [];
  for (const r of RESOURCES) {
    for (const a of (RESOURCE_ACTIONS[r] as readonly Action[])) {
      const s = m[r][a];
      if (s) out.push({ resource: r, action: a, scope: s });
    }
  }
  return out;
}

export function RoleEditSheet({ role, mode, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOpen = mode !== null;
  const isEdit = mode === "edit";
  const isSystem = role?.isSystem ?? false;

  useEffect(() => {
    if (mode === "edit" && role) {
      setName(role.name);
      setDescription(role.description ?? "");
      setMatrix(toMatrix(role.permissions));
    } else if (mode === "create") {
      setName("");
      setDescription("");
      setMatrix(emptyMatrix());
    }
  }, [mode, role]);

  function setCell(r: Resource, a: Action, s: Scope | null) {
    setMatrix((prev) => ({
      ...prev,
      [r]: { ...prev[r], [a]: s },
    }));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name ist Pflichtfeld");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      permissions: toPermissions(matrix),
    };
    const res = await fetch(
      isEdit && role ? `/api/admin/roles/${role.id}` : "/api/admin/roles",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Speichern fehlgeschlagen");
      return;
    }
    toast.success(isEdit ? "Rolle aktualisiert" : "Rolle erstellt");
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!role) return;
    setConfirmDelete(false);
    const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Löschen fehlgeschlagen");
      return;
    }
    toast.success("Rolle gelöscht");
    onSaved();
    onClose();
  }

  const permissionCount = useMemo(() => toPermissions(matrix).length, [matrix]);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full !max-w-[min(100vw,56rem)] overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {isEdit ? role?.name : "Neue Rolle"}
              {isSystem && <Badge variant="outline" className="gap-1 text-xs"><Lock className="h-3 w-3" />System</Badge>}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              {isSystem
                ? "Name und Beschreibung sind geschützt. Berechtigungen können von SUPERADMIN angepasst werden."
                : isEdit
                  ? "Berechtigungen und Beschreibung anpassen"
                  : "Neue Rolle mit individuellen Berechtigungen anlegen"}
            </p>
          </SheetHeader>

          <div className="flex-1 px-4 py-2 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSystem}
                  placeholder="z.B. Abteilungsleiter"
                />
              </div>
              <div className="space-y-2">
                <Label>Beschreibung</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSystem}
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Berechtigungen</Label>
                  <p className="text-xs text-muted-foreground">
                    Pro Aktion den maximalen Umfang wählen. Leer = keine Berechtigung.
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {permissionCount} aktive Berechtigungen
                </Badge>
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="text-left font-medium px-3 py-2 w-40">Ressource</th>
                      {ACTIONS.map((a) => (
                        <th key={a} className="text-left font-medium px-3 py-2">
                          {ACTION_LABELS[a]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCES.map((r) => {
                      const applicable = new Set(RESOURCE_ACTIONS[r]);
                      return (
                        <tr key={r} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{RESOURCE_LABELS[r]}</td>
                          {ACTIONS.map((a) => {
                            const applies = applicable.has(a);
                            const current = matrix[r][a];
                            return (
                              <td key={a} className="px-3 py-2">
                                {applies ? (
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setCell(r, a, null)}
                                      className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                                        current === null
                                          ? "border-border bg-muted text-muted-foreground"
                                          : "border-transparent text-muted-foreground hover:bg-muted/60"
                                      }`}
                                    >
                                      —
                                    </button>
                                    {SCOPES.map((s) => (
                                      <button
                                        key={s}
                                        type="button"
                                        onClick={() => setCell(r, a, s)}
                                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                                          current === s
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                        }`}
                                      >
                                        {SCOPE_LABELS[s]}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground/50">n/a</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-muted-foreground space-y-0.5">
                <p><strong>Eigene:</strong> nur eigene Daten</p>
                <p><strong>Team:</strong> Daten eigener Mitarbeiter / Abteilung</p>
                <p><strong>Alle:</strong> organisationsweit</p>
              </div>
            </div>

            {isEdit && role && !isSystem && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium mb-1">Rolle löschen</p>
                <p className="text-xs text-muted-foreground mb-3">
                  {role._count && role._count.users > 0
                    ? `Diese Rolle ist ${role._count.users} Mitarbeiter(n) zugewiesen und kann erst gelöscht werden, wenn die Zuweisungen entfernt sind.`
                    : "Endgültig löschen — kann nicht rückgängig gemacht werden."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-2"
                  onClick={() => setConfirmDelete(true)}
                  disabled={!!role._count && role._count.users > 0}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Rolle löschen
                </Button>
              </div>
            )}
          </div>

          <SheetFooter className="gap-2 border-t border-border">
            <Button variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Wird gespeichert..." : isEdit ? "Änderungen speichern" : "Rolle erstellen"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rolle löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Rolle wird endgültig entfernt. Zuweisungen müssen vorher aufgehoben sein.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
