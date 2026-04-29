"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface VacRow {
  userId: string;
  name: string;
  employeeNumber: string | null;
  department: string | null;
  totalDays: number;
  carryoverDays: number;
  totalAvailable: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  sickDays: number;
}

export function VacationReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<VacRow[]>([]);
  const [carryoverDeadline, setCarryoverDeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/vacation?year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setCarryoverDeadline(d.carryoverDeadline ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  const totalUsed = rows.reduce((s, r) => s + r.usedDays, 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remainingDays, 0);
  const totalPending = rows.reduce((s, r) => s + r.pendingDays, 0);
  const totalSick = rows.reduce((s, r) => s + r.sickDays, 0);
  const totalCarryover = rows.reduce((s, r) => s + r.carryoverDays, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v ?? String(year)))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {carryoverDeadline && (
          <p className="text-xs text-muted-foreground">
            Uebertrag verfaellt am {carryoverDeadline}
          </p>
        )}
      </div>

      {/* Summary */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Genommen</p>
              <p className="text-2xl font-bold">{totalUsed}</p>
              <p className="text-xs text-muted-foreground">Tage</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Beantragt</p>
              <p className="text-2xl font-bold text-yellow-500">{totalPending}</p>
              <p className="text-xs text-muted-foreground">Tage</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Verbleibend</p>
              <p className="text-2xl font-bold text-green-500">{totalRemaining}</p>
              <p className="text-xs text-muted-foreground">Tage</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Uebertrag VJ</p>
              <p className="text-2xl font-bold text-blue-500">{totalCarryover}</p>
              <p className="text-xs text-muted-foreground">Tage</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Kranktage</p>
              <p className="text-2xl font-bold text-red-500">{totalSick}</p>
              <p className="text-xs text-muted-foreground">gesamt</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Keine Daten verfuegbar
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nr.</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Abteilung</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Anspruch</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Uebertrag</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Gesamt</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Genommen</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Beantragt</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Rest</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Krank</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Auslastung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pct = row.totalAvailable > 0 ? Math.round((row.usedDays / row.totalAvailable) * 100) : 0;
                return (
                  <tr key={row.userId} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                      {row.employeeNumber ?? "—"}
                    </td>
                    <td className="py-2 px-3 font-medium">{row.name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{row.department ?? "—"}</td>
                    <td className="py-2 px-3 text-center font-mono">{row.totalDays}</td>
                    <td className="py-2 px-3 text-center font-mono">
                      {row.carryoverDays > 0 ? (
                        <Badge variant="outline" className="text-xs font-mono text-blue-500">+{row.carryoverDays}</Badge>
                      ) : "—"}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-semibold">{row.totalAvailable}</td>
                    <td className="py-2 px-3 text-center font-mono">{row.usedDays}</td>
                    <td className="py-2 px-3 text-center">
                      {row.pendingDays > 0 ? (
                        <Badge className="bg-yellow-600 text-white text-xs">{row.pendingDays}</Badge>
                      ) : (
                        <span className="font-mono">0</span>
                      )}
                    </td>
                    <td className={cn(
                      "py-2 px-3 text-center font-mono font-semibold",
                      row.remainingDays <= 5 ? "text-red-500" : "text-green-500"
                    )}>
                      {row.remainingDays}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">
                      {row.sickDays > 0 ? (
                        <span className="text-red-500">{row.sickDays}</span>
                      ) : "0"}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-green-500"
                            )}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
