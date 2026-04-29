"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Pencil, Check, X, UserCog } from "lucide-react";

interface Department {
  id: string;
  name: string;
  kostenstelleNr: string | null;
  leaderId: string | null;
  leader: { id: string; name: string } | null;
  _count: { users: number };
}

interface UserOption {
  id: string;
  name: string;
  roleNames: string[];
}

export function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [newName, setNewName] = useState("");
  const [newKst, setNewKst] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKst, setEditKst] = useState("");
  const [editLeaderId, setEditLeaderId] = useState("");

  async function fetchDepartments() {
    const res = await fetch("/api/admin/departments");
    const data = await res.json();
    setDepartments(data.departments ?? []);
  }

  useEffect(() => {
    fetchDepartments();
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        type RawUser = { id: string; name: string; roles?: { role: { name: string } }[] };
        const raw = (d.users ?? []) as RawUser[];
        setUsers(raw.map((u) => ({
          id: u.id,
          name: u.name,
          roleNames: (u.roles ?? []).map((r) => r.role.name),
        })));
      });
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), kostenstelleNr: newKst.trim() || null }),
    });
    if (res.ok) { setNewName(""); setNewKst(""); await fetchDepartments(); }
    else { const d = await res.json(); setError(d.error ?? "Fehler"); }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/departments/${id}`, { method: "DELETE" });
    if (res.ok) await fetchDepartments();
    else { const d = await res.json(); setError(d.error ?? "Fehler beim Loeschen"); }
  }

  function startEdit(d: Department) {
    setEditId(d.id);
    setEditName(d.name);
    setEditKst(d.kostenstelleNr ?? "");
    setEditLeaderId(d.leaderId ?? "");
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) return;
    setError(null);
    const res = await fetch(`/api/admin/departments/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        kostenstelleNr: editKst.trim() || null,
        leaderId: editLeaderId || null,
      }),
    });
    if (res.ok) {
      // Server automatically grants the MANAGER role to the new leader.
      setEditId(null);
      await fetchDepartments();
    }
    else {
      try {
        const d = await res.json();
        setError(d.error ?? "Fehler beim Speichern");
      } catch {
        setError("Fehler beim Speichern");
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abteilungen</CardTitle>
        <CardDescription>Abteilungen, Kostenstellen und Abteilungsleiter verwalten</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Abteilungsname" className="flex-1" />
          <Input value={newKst} onChange={(e) => setNewKst(e.target.value)} placeholder="KST-Nr." className="w-24 font-mono text-center" />
          <Button type="submit" size="sm" disabled={loading}><Plus className="h-4 w-4 mr-1" />Hinzufuegen</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          {departments.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-3 border border-border rounded-xl gap-2">
              {editId === d.id ? (
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 h-8 text-sm" />
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground shrink-0">KST</Label>
                      <Input value={editKst} onChange={(e) => setEditKst(e.target.value)} className="w-20 h-8 font-mono text-center text-sm" placeholder="—" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={editLeaderId || "__none__"}
                      onValueChange={(v) => setEditLeaderId(v === "__none__" ? "" : (v ?? ""))}
                    >
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue placeholder="Abteilungsleiter wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Kein Leiter</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={saveEdit}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{d.name}</span>
                      {d.kostenstelleNr && (
                        <Badge variant="outline" className="text-xs font-mono shrink-0">KST {d.kostenstelleNr}</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs shrink-0">{d._count.users} MA</Badge>
                    </div>
                    {d.leader ? (
                      <div className="flex items-center gap-1.5">
                        <UserCog className="h-3 w-3 text-primary" />
                        <span className="text-xs text-primary font-medium">{d.leader.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Kein Abteilungsleiter</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(d)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(d.id)} disabled={d._count.users > 0}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
