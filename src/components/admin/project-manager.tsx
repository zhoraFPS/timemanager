"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((d) => { setProjects(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  async function handleAdd() {
    if (!newName.trim() || !newCode.trim()) return;
    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, code: newCode, description: newDesc, color: newColor }),
    });
    if (res.ok) {
      setNewName(""); setNewCode(""); setNewDesc(""); setNewColor(COLORS[0]);
      setShowAdd(false);
      load();
    }
  }

  function startEdit(p: Project) {
    setEditId(p.id);
    setEditName(p.name);
    setEditCode(p.code);
    setEditDesc(p.description ?? "");
    setEditColor(p.color ?? COLORS[0]);
  }

  async function saveEdit() {
    if (!editId || !editName.trim() || !editCode.trim()) return;
    await fetch(`/api/admin/projects/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, code: editCode, description: editDesc, color: editColor }),
    });
    setEditId(null);
    load();
  }

  async function toggleActive(p: Project) {
    await fetch(`/api/admin/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  async function handleDelete(p: Project) {
    await fetch(`/api/admin/projects/${p.id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Projekte & Events ({projects.length})</p>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Hinzufuegen
          </Button>
        </div>

        {showAdd && (
          <div className="border border-border rounded-md p-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="z.B. Heimspiel-Organisation" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="z.B. HOME" className="h-8 text-sm font-mono" maxLength={10} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Beschreibung (optional)</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Kurze Beschreibung" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Farbe</Label>
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)}
                    className={cn("w-6 h-6 rounded-full border-2 transition-all",
                      newColor === c ? "border-white scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || !newCode.trim()}>
                <Check className="h-3.5 w-3.5 mr-1" />Erstellen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                <X className="h-3.5 w-3.5 mr-1" />Abbrechen
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {projects.map((p) => (
            <div key={p.id} className={cn(
              "flex items-center gap-3 p-2 rounded-md hover:bg-muted/20 transition-colors",
              !p.isActive && "opacity-50"
            )}>
              {editId === p.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setEditColor(c)}
                        className={cn("w-5 h-5 rounded-full border-2 transition-all",
                          editColor === c ? "border-white scale-110" : "border-transparent")}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <Input value={editCode} onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="h-7 w-20 text-xs font-mono" maxLength={10} />
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="h-7 flex-1 text-sm" />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.color ?? "#6b7280" }} />
                  <Badge variant="outline" className="font-mono text-xs shrink-0">{p.code}</Badge>
                  <span className="text-sm font-medium flex-1">{p.name}</span>
                  {p.description && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</span>
                  )}
                  {!p.isActive && <Badge variant="outline" className="text-xs text-destructive">Inaktiv</Badge>}
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleActive(p)}>
                      {p.isActive ? "Deakt." : "Akt."}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Projekte angelegt
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
