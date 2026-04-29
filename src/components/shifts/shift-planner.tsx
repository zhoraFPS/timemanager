"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, addWeeks, startOfWeek, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string | null;
  isActive: boolean;
}

interface ShiftEntry {
  id: string;
  userId: string;
  date: string;
  user: { id: string; name: string };
  template: { id: string; name: string; startTime: string; endTime: string; color: string | null };
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function ShiftPlanner() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const weekStr = format(weekStart, "yyyy-MM-dd");

  const fetchShifts = useCallback(() => {
    setLoading(true);
    fetch(`/api/shifts?week=${weekStr}`)
      .then((r) => r.json())
      .then((d) => { setShifts(d.shifts ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [weekStr]);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  useEffect(() => {
    fetch("/api/admin/shift-templates")
      .then((r) => r.json())
      .then((d) => {
        const active = (d as ShiftTemplate[]).filter((t) => t.isActive);
        setTemplates(active);
        if (active.length > 0 && !selectedTemplate) setSelectedTemplate(active[0].id);
      })
      .catch(() => {});
  }, []);

  // Get unique users from shifts
  const userMap = new Map<string, string>();
  for (const s of shifts) {
    userMap.set(s.user.id, s.user.name);
  }
  const users = Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function getShift(userId: string, date: Date): ShiftEntry | undefined {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts.find((s) => s.userId === userId && s.date.startsWith(dateStr));
  }

  async function assignShift(userId: string, date: Date) {
    if (!selectedTemplate) return;
    await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, templateId: selectedTemplate, date: format(date, "yyyy-MM-dd") }),
    });
    fetchShifts();
  }

  async function removeShift(userId: string, date: Date) {
    await fetch("/api/shifts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, date: format(date, "yyyy-MM-dd") }),
    });
    fetchShifts();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[200px] text-center">
          KW {format(weekStart, "ww", { locale: de })} — {format(weekStart, "dd.MM.")} bis {format(addDays(weekStart, 6), "dd.MM.yyyy")}
        </span>
        <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          Heute
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Schicht zuweisen:</span>
          <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v ?? "")}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Vorlage waehlen" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color ?? "#6b7280" }} />
                    {t.name} ({t.startTime}–{t.endTime})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap">
        {templates.map((t) => (
          <Badge key={t.id} variant="outline" className="text-xs gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color ?? "#6b7280" }} />
            {t.name} ({t.startTime}–{t.endTime})
          </Badge>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Keine Schichten geplant. Klicke auf eine Zelle um eine Schicht zuzuweisen.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground w-40">Mitarbeiter</th>
                {days.map((d, i) => (
                  <th key={i} className={cn(
                    "text-center py-2 px-2 font-medium text-muted-foreground min-w-[100px]",
                    i >= 5 && "bg-muted/20"
                  )}>
                    <div>{WEEKDAYS[i]}</div>
                    <div className="text-xs">{format(d, "dd.MM.")}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/40 hover:bg-muted/5">
                  <td className="py-2 px-3 font-medium">{user.name}</td>
                  {days.map((d, i) => {
                    const shift = getShift(user.id, d);
                    return (
                      <td key={i} className={cn(
                        "py-1 px-1 text-center",
                        i >= 5 && "bg-muted/10"
                      )}>
                        {shift ? (
                          <div
                            className="rounded px-2 py-1 text-xs text-white relative group cursor-pointer"
                            style={{ backgroundColor: shift.template.color ?? "#6b7280" }}
                          >
                            <div className="font-medium">{shift.template.name}</div>
                            <div className="text-[10px] opacity-80">
                              {shift.template.startTime}–{shift.template.endTime}
                            </div>
                            <button
                              onClick={() => removeShift(user.id, d)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => assignShift(user.id, d)}
                            className="w-full h-10 rounded border border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            title={selectedTemplate ? "Schicht zuweisen" : "Vorlage waehlen"}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
