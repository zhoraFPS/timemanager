"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban } from "lucide-react";

interface ProjectRow {
  projectId: string;
  name: string;
  code: string;
  color: string | null;
  totalMins: number;
  entryCount: number;
  users: Array<{ userId: string; name: string; mins: number }>;
}

const MONTHS = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function fmtHours(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function ProjectReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/projects?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setProjects(d.projects ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month]);

  const totalMins = projects.reduce((s, p) => s + p.totalMins, 0);
  const totalEntries = projects.reduce((s, p) => s + p.entryCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v ?? String(month)))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v ?? String(year)))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Projekte aktiv</p>
              <p className="text-2xl font-bold">{projects.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Stunden gesamt</p>
              <p className="text-2xl font-bold">{fmtHours(totalMins)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Buchungen</p>
              <p className="text-2xl font-bold">{totalEntries}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64" />
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Keine Projektbuchungen in diesem Monat
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const pct = totalMins > 0 ? Math.round((p.totalMins / totalMins) * 100) : 0;
            return (
              <Card key={p.projectId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.color ?? "#6b7280" }} />
                    <Badge variant="outline" className="font-mono text-xs">{p.code}</Badge>
                    <CardTitle className="text-base flex-1">{p.name}</CardTitle>
                    <span className="text-lg font-bold font-mono">{fmtHours(p.totalMins)}h</span>
                    <Badge variant="outline" className="text-xs">{pct}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {/* Progress bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: p.color ?? "#6b7280" }} />
                  </div>
                  {/* User breakdown */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {p.users.map((u) => (
                      <div key={u.userId} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate">{u.name}</span>
                        <span className="font-mono">{fmtHours(u.mins)}h</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
