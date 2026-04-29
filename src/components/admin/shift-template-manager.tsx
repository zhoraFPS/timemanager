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

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string | null;
  isActive: boolean;
}

const COLORS = [
  "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#10b981",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export function ShiftTemplateManager() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", startTime: "08:00", endTime: "16:00", color: COLORS[1] });
  const [editForm, setEditForm] = useState({ name: "", startTime: "", endTime: "", color: "" });

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    fetch("/api/admin/shift-templates")
      .then((r) => r.json())
      .then((d) => { setTemplates(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    await fetch("/api/admin/shift-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", startTime: "08:00", endTime: "16:00", color: COLORS[1] });
    setShowAdd(false);
    load();
  }

  function startEdit(t: ShiftTemplate) {
    setEditId(t.id);
    setEditForm({ name: t.name, startTime: t.startTime, endTime: t.endTime, color: t.color ?? COLORS[1] });
  }

  async function saveEdit() {
    if (!editId) return;
    await fetch(`/api/admin/shift-templates/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditId(null);
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/shift-templates/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Schichtvorlagen ({templates.length})</p>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Hinzufuegen
          </Button>
        </div>

        {showAdd && (
          <div className="border border-border rounded-md p-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="z.B. Fruehschicht" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Von</Label>
                <Input type="time" value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bis</Label>
                <Input type="time" value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Farbe</Label>
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={cn("w-6 h-6 rounded-full border-2 transition-all",
                      form.color === c ? "border-white scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!form.name.trim()}>
                <Check className="h-3.5 w-3.5 mr-1" />Erstellen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                <X className="h-3.5 w-3.5 mr-1" />Abbrechen
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {templates.map((t) => (
            <div key={t.id} className={cn(
              "flex items-center gap-3 p-2 rounded-md hover:bg-muted/20 transition-colors",
              !t.isActive && "opacity-50"
            )}>
              {editId === t.id ? (
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="h-7 w-32 text-sm" />
                  <Input type="time" value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} className="h-7 w-24 text-sm" />
                  <span className="text-xs">–</span>
                  <Input type="time" value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} className="h-7 w-24 text-sm" />
                  <div className="flex gap-1">
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setEditForm({ ...editForm, color: c })}
                        className={cn("w-4 h-4 rounded-full border-2 transition-all",
                          editForm.color === c ? "border-white scale-110" : "border-transparent")}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveEdit}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color ?? "#6b7280" }} />
                  <span className="text-sm font-medium flex-1">{t.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{t.startTime}–{t.endTime}</span>
                  {!t.isActive && <Badge variant="outline" className="text-xs text-red-400">Inaktiv</Badge>}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Noch keine Schichtvorlagen</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
