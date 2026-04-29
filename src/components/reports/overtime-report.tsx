"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Row {
  userId: string;
  name: string;
  employeeNumber: string | null;
  department: string | null;
  contractType: string;
  hoursPerDay: number;
  targetMins: number;
  actualMins: number;
  saldoMins: number;
}

const MONTHS = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function fmtHours(mins: number) {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(mins);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

export function OvertimeReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/monthly?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month]);

  // Sort by overtime descending
  const sorted = [...rows].sort((a, b) => b.saldoMins - a.saldoMins);
  const overtimeEmployees = sorted.filter((r) => r.saldoMins > 0);
  const undertimeEmployees = sorted.filter((r) => r.saldoMins < -30);
  const criticalOvertime = sorted.filter((r) => r.saldoMins > 10 * 60); // > 10h

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

      {/* Alert cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Mit Ueberstunden</p>
              <p className="text-2xl font-bold text-warning">{overtimeEmployees.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Minusstunden</p>
              <p className="text-2xl font-bold text-destructive">{undertimeEmployees.length}</p>
            </CardContent>
          </Card>
          <Card className={cn(criticalOvertime.length > 0 && "border-red-500/50")}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Kritisch (&gt;10h)</p>
              <p className="text-2xl font-bold text-destructive">
                {criticalOvertime.length > 0 && <AlertTriangle className="h-5 w-5 inline mr-1" />}
                {criticalOvertime.length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64" />
      ) : sorted.length === 0 ? (
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
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Vertrag</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Soll/Tag</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Saldo</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.userId} className={cn(
                  "border-b border-border/40 hover:bg-muted/10 transition-colors",
                  row.saldoMins > 10 * 60 && "bg-destructive/5"
                )}>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                    {row.employeeNumber ?? "—"}
                  </td>
                  <td className="py-2 px-3 font-medium">{row.name}</td>
                  <td className="py-2 px-3 text-muted-foreground">{row.department ?? "—"}</td>
                  <td className="py-2 px-3 text-center">
                    <Badge variant="outline" className="text-xs">{row.contractType}</Badge>
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-xs">{row.hoursPerDay}h</td>
                  <td className={cn(
                    "py-2 px-3 text-center font-mono text-xs font-semibold",
                    row.saldoMins >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {row.saldoMins >= 0 ? "+" : ""}{fmtHours(row.saldoMins)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {row.saldoMins > 10 * 60 ? (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />Kritisch
                      </Badge>
                    ) : row.saldoMins > 0 ? (
                      <Badge className="bg-warning text-white text-xs">Ueberstunden</Badge>
                    ) : row.saldoMins < -30 ? (
                      <Badge variant="outline" className="text-xs text-destructive border-destructive/50">Minus</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
