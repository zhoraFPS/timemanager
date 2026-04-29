"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";
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
  daysWorked: number;
  workingDays: number;
}

interface ReportData {
  year: number;
  month: number;
  workingDaysInMonth: number;
  rows: Row[];
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

export function MonthlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/monthly?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month]);

  function downloadCsv() {
    window.open(`/api/reports/export-csv?year=${year}&month=${month}`, "_blank");
  }

  const totalActual = data?.rows.reduce((s, r) => s + r.actualMins, 0) ?? 0;
  const totalTarget = data?.rows.reduce((s, r) => s + r.targetMins, 0) ?? 0;
  const totalSaldo = totalActual - totalTarget;

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
        <Button variant="outline" size="sm" onClick={downloadCsv}>
          <Download className="h-4 w-4 mr-2" />CSV Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.open(`/api/reports/pdf-monthly?year=${year}&month=${month}`, "_blank")}>
          <FileText className="h-4 w-4 mr-2" />PDF Nachweis
        </Button>
      </div>

      {/* Summary cards */}
      {data && !loading && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Mitarbeiter</p>
              <p className="text-2xl font-bold">{data.rows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Gesamt Ist</p>
              <p className="text-2xl font-bold">{fmtHours(totalActual)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Gesamt Saldo</p>
              <p className={cn("text-2xl font-bold", totalSaldo >= 0 ? "text-success" : "text-destructive")}>
                {totalSaldo >= 0 ? "+" : ""}{fmtHours(totalSaldo)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <Skeleton className="h-64" />
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Keine Daten fuer diesen Zeitraum
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
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Tage</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Soll</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Ist</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Saldo</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.userId} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                    {row.employeeNumber ?? "—"}
                  </td>
                  <td className="py-2 px-3 font-medium">{row.name}</td>
                  <td className="py-2 px-3 text-muted-foreground">{row.department ?? "—"}</td>
                  <td className="py-2 px-3 text-center">
                    <Badge variant="outline" className="text-xs">{row.contractType}</Badge>
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-xs">
                    {row.daysWorked}/{row.workingDays}
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-xs">
                    {fmtHours(row.targetMins)}
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-xs">
                    {fmtHours(row.actualMins)}
                  </td>
                  <td className={cn(
                    "py-2 px-3 text-center font-mono text-xs font-semibold",
                    row.saldoMins >= 0 ? "text-success" : "text-destructive"
                  )}>
                    <span className="inline-flex items-center gap-1">
                      {row.saldoMins > 30 ? <TrendingUp className="h-3 w-3" /> :
                       row.saldoMins < -30 ? <TrendingDown className="h-3 w-3" /> :
                       <Minus className="h-3 w-3" />}
                      {row.saldoMins >= 0 ? "+" : ""}{fmtHours(row.saldoMins)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => window.open(`/api/reports/pdf-monthly?userId=${row.userId}&year=${year}&month=${month}`, "_blank")}
                      title="PDF Monatsnachweis"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold bg-muted/20">
                <td colSpan={5} className="py-2 px-3 text-muted-foreground">Gesamt</td>
                <td className="py-2 px-3 text-center font-mono text-sm">{fmtHours(totalTarget)}</td>
                <td className="py-2 px-3 text-center font-mono text-sm">{fmtHours(totalActual)}</td>
                <td className={cn(
                  "py-2 px-3 text-center font-mono text-sm",
                  totalSaldo >= 0 ? "text-success" : "text-destructive"
                )}>
                  {totalSaldo >= 0 ? "+" : ""}{fmtHours(totalSaldo)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
