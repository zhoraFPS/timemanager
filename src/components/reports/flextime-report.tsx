"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FlextimeMonth {
  year: number;
  month: number;
  targetMins: number;
  actualMins: number;
  saldoMins: number;
  cumulativeMins: number;
}

interface FlextimeData {
  name: string;
  employeeNumber: string | null;
  initialBalanceHours: number;
  hoursPerDay: number;
  months: FlextimeMonth[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

function fmtHours(mins: number) {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? "-" : mins > 0 ? "+" : "";
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

function fmtDecimal(mins: number) {
  return (mins / 60).toFixed(1);
}

export function FlextimeReport() {
  const [data, setData] = useState<FlextimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/flextime?months=12")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-96" />;
  if (!data) return <p className="text-sm text-muted-foreground">Keine Daten verfuegbar.</p>;

  const currentMonth = data.months[data.months.length - 1];
  const cumulative = currentMonth?.cumulativeMins ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktueller Gleitzeitsaldo</CardDescription>
            <CardTitle className={`text-2xl font-mono ${cumulative >= 0 ? "text-success" : "text-destructive"}`}>
              {fmtHours(cumulative)} h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Kumuliert ueber {data.months.length} Monate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saldo aktueller Monat</CardDescription>
            <CardTitle className={`text-2xl font-mono ${(currentMonth?.saldoMins ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
              {fmtHours(currentMonth?.saldoMins ?? 0)} h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Ist {fmtDecimal(currentMonth?.actualMins ?? 0)}h / Soll {fmtDecimal(currentMonth?.targetMins ?? 0)}h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sollstunden / Tag</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {data.hoursPerDay.toFixed(1)} h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {data.initialBalanceHours !== 0 && `Anfangssaldo: ${data.initialBalanceHours > 0 ? "+" : ""}${data.initialBalanceHours.toFixed(1)}h`}
              {data.initialBalanceHours === 0 && "Kein Anfangssaldo"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monatsverlauf</CardTitle>
          <CardDescription>Gleitzeitsaldo der letzten {data.months.length} Monate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Monat</th>
                  <th className="pb-2 font-medium text-right">Soll</th>
                  <th className="pb-2 font-medium text-right">Ist</th>
                  <th className="pb-2 font-medium text-right">Saldo</th>
                  <th className="pb-2 font-medium text-right">Kumuliert</th>
                  <th className="pb-2 font-medium text-center w-16">Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m, i) => {
                  const isCurrentMonth =
                    m.year === new Date().getFullYear() &&
                    m.month === new Date().getMonth() + 1;

                  return (
                    <tr
                      key={`${m.year}-${m.month}`}
                      className={`border-b last:border-0 ${isCurrentMonth ? "bg-muted/50 font-medium" : ""}`}
                    >
                      <td className="py-2">
                        {MONTH_NAMES[m.month - 1]} {m.year}
                        {isCurrentMonth && (
                          <Badge variant="secondary" className="ml-2 text-xs">aktuell</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono">{fmtDecimal(m.targetMins)}h</td>
                      <td className="py-2 text-right font-mono">{fmtDecimal(m.actualMins)}h</td>
                      <td className={`py-2 text-right font-mono ${m.saldoMins >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmtHours(m.saldoMins)}
                      </td>
                      <td className={`py-2 text-right font-mono font-semibold ${m.cumulativeMins >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmtHours(m.cumulativeMins)}
                      </td>
                      <td className="py-2 text-center">
                        {m.saldoMins > 30 ? (
                          <TrendingUp className="h-4 w-4 text-success inline" />
                        ) : m.saldoMins < -30 ? (
                          <TrendingDown className="h-4 w-4 text-destructive inline" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground inline" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
