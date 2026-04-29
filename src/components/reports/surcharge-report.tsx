"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Moon, Sun, CalendarHeart } from "lucide-react";
import { cn } from "@/lib/utils";

interface SurchargeRow {
  userId: string;
  name: string;
  employeeNumber: string | null;
  department: string | null;
  normalMins: number;
  nightMins: number;
  nightPercent: number;
  saturdayMins: number;
  saturdayPercent: number;
  sundayMins: number;
  sundayPercent: number;
  holidayMins: number;
  holidayPercent: number;
  totalSurchargeMins: number;
}

interface SurchargeConfig {
  nightEnabled: boolean;
  weekendEnabled: boolean;
  holidayEnabled: boolean;
}

const MONTHS = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function fmtHours(mins: number) {
  if (mins === 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function SurchargeReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<SurchargeRow[]>([]);
  const [config, setConfig] = useState<SurchargeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/surcharges?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setConfig(d.config ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year, month]);

  const totalNight = rows.reduce((s, r) => s + r.nightMins, 0);
  const totalWeekend = rows.reduce((s, r) => s + r.saturdayMins + r.sundayMins, 0);
  const totalHoliday = rows.reduce((s, r) => s + r.holidayMins, 0);
  const withSurcharges = rows.filter((r) => r.totalSurchargeMins > 0);

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
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">MA mit Zuschlaegen</p>
              <p className="text-2xl font-bold">{withSurcharges.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Moon className="h-4 w-4 mx-auto mb-1 text-indigo-400" />
              <p className="text-xs text-muted-foreground">Nacht gesamt</p>
              <p className="text-xl font-bold text-indigo-400">{fmtHours(totalNight)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Sun className="h-4 w-4 mx-auto mb-1 text-orange-400" />
              <p className="text-xs text-muted-foreground">Wochenende gesamt</p>
              <p className="text-xl font-bold text-orange-400">{fmtHours(totalWeekend)}h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <CalendarHeart className="h-4 w-4 mx-auto mb-1 text-destructive" />
              <p className="text-xs text-muted-foreground">Feiertag gesamt</p>
              <p className="text-xl font-bold text-destructive">{fmtHours(totalHoliday)}h</p>
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
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Normal</th>
                {config?.nightEnabled && (
                  <th className="text-center py-2 px-3 font-medium text-indigo-400">
                    Nacht ({rows[0]?.nightPercent ?? 25}%)
                  </th>
                )}
                {config?.weekendEnabled && (
                  <>
                    <th className="text-center py-2 px-3 font-medium text-orange-400">
                      Sa ({rows[0]?.saturdayPercent ?? 25}%)
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-orange-400">
                      So ({rows[0]?.sundayPercent ?? 50}%)
                    </th>
                  </>
                )}
                {config?.holidayEnabled && (
                  <th className="text-center py-2 px-3 font-medium text-destructive">
                    Feiertag ({rows[0]?.holidayPercent ?? 100}%)
                  </th>
                )}
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Zuschlag ges.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.userId}
                  className={cn(
                    "border-b border-border/40 hover:bg-muted/10 transition-colors",
                    row.totalSurchargeMins > 0 && "bg-yellow-500/5"
                  )}
                >
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                    {row.employeeNumber ?? "—"}
                  </td>
                  <td className="py-2 px-3 font-medium">{row.name}</td>
                  <td className="py-2 px-3 text-muted-foreground">{row.department ?? "—"}</td>
                  <td className="py-2 px-3 text-center font-mono text-xs">
                    {fmtHours(row.normalMins)}
                  </td>
                  {config?.nightEnabled && (
                    <td className="py-2 px-3 text-center font-mono text-xs text-indigo-400">
                      {fmtHours(row.nightMins)}
                    </td>
                  )}
                  {config?.weekendEnabled && (
                    <>
                      <td className="py-2 px-3 text-center font-mono text-xs text-orange-400">
                        {fmtHours(row.saturdayMins)}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-xs text-orange-400">
                        {fmtHours(row.sundayMins)}
                      </td>
                    </>
                  )}
                  {config?.holidayEnabled && (
                    <td className="py-2 px-3 text-center font-mono text-xs text-destructive">
                      {fmtHours(row.holidayMins)}
                    </td>
                  )}
                  <td className="py-2 px-3 text-center">
                    {row.totalSurchargeMins > 0 ? (
                      <Badge className="bg-warning text-white text-xs">
                        {fmtHours(row.totalSurchargeMins)}h
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
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
