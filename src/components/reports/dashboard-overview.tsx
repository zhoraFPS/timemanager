"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Clock, Users as UsersIcon,
  BedDouble, Palmtree, AlertTriangle, Hourglass, Stethoscope,
} from "lucide-react"; // Stethoscope/Palmtree weiterhin fuer KPI-Karten benoetigt
import { cn } from "@/lib/utils";
import { OpenStampsCard } from "@/components/reports/open-stamps-card";

// Absichtlich kein Top-N-Abwesenheits-Ranking — das wäre ein Krankheits-Pranger.
// Aggregierte Monatssumme (KPI-Karten oben) ist DSGVO-/Betriebsrat-freundlich.

interface Dashboard {
  scope: { year: number; month: number };
  kpis: {
    totalActualHours: number | null;
    totalTargetHours: number | null;
    balanceHours: number | null;
    deltaVsPrevMonth: number | null;
    activeEmployees: number;
    sickDaysThisMonth: number;
    vacationDaysThisMonth: number;
    pendingApprovals: number;
    pendingCorrections: number;
    openStamps: number;
  };
  monthlyTrend: Array<{ year: number; month: number; actualHours: number; targetHours: number }>;
  topOvertime: Array<{ userId: string; name: string; balanceHours: number }>;
  departmentBreakdown: Array<{
    departmentId: string | null;
    name: string;
    actualHours: number;
    targetHours: number;
  }>;
}

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function fmtNumber(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(n);
}

export function DashboardOverview() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Dashboard konnte nicht geladen werden.
        </CardContent>
      </Card>
    );
  }

  const monthName = `${MONTHS[data.scope.month - 1]} ${data.scope.year}`;

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Aktive Mitarbeiter"
          value={String(data.kpis.activeEmployees)}
          icon={UsersIcon}
        />
        <KpiCard
          label={`Ist-Stunden ${monthName}`}
          value={`${fmtNumber(data.kpis.totalActualHours)} h`}
          icon={Clock}
          delta={data.kpis.deltaVsPrevMonth}
          deltaHint="vs. Vormonat"
        />
        <KpiCard
          label={`Soll-Stunden ${monthName}`}
          value={`${fmtNumber(data.kpis.totalTargetHours)} h`}
          icon={Hourglass}
        />
        <KpiCard
          label="Kollektiv-Saldo"
          value={`${data.kpis.balanceHours !== null && data.kpis.balanceHours >= 0 ? "+" : ""}${fmtNumber(data.kpis.balanceHours)} h`}
          tone={data.kpis.balanceHours !== null ? (data.kpis.balanceHours >= 0 ? "success" : "destructive") : "neutral"}
          icon={data.kpis.balanceHours !== null && data.kpis.balanceHours >= 0 ? TrendingUp : TrendingDown}
        />
        <KpiCard
          label="Krankheitstage (Monat)"
          value={String(data.kpis.sickDaysThisMonth)}
          icon={Stethoscope}
        />
        <KpiCard
          label="Urlaubstage (Monat)"
          value={String(data.kpis.vacationDaysThisMonth)}
          icon={Palmtree}
        />
        <KpiCard
          label="Offene Anträge"
          value={String(data.kpis.pendingApprovals + data.kpis.pendingCorrections)}
          icon={BedDouble}
          tone={data.kpis.pendingApprovals + data.kpis.pendingCorrections > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          label="Offene Stempel > 2h"
          value={String(data.kpis.openStamps)}
          icon={AlertTriangle}
          tone={data.kpis.openStamps > 0 ? "destructive" : "neutral"}
        />
      </div>

      {/* Offene Stempel — nur sichtbar wenn welche existieren */}
      <OpenStampsCard />

      {/* Trend-Chart (letzte 12 Monate Ist vs Soll) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trend (letzte 12 Monate)</CardTitle>
          <CardDescription>Ist-Stunden (farbig) vs. Soll-Stunden (grau)</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart data={data.monthlyTrend} />
        </CardContent>
      </Card>

      {/* Department-Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stunden pro Abteilung ({monthName})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.departmentBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Daten</p>
          ) : (
            <div className="space-y-2">
              {data.departmentBreakdown.map((d) => {
                const max = Math.max(...data.departmentBreakdown.map((x) => Math.max(x.actualHours, x.targetHours)), 1);
                const actualPct = (d.actualHours / max) * 100;
                const targetPct = (d.targetHours / max) * 100;
                return (
                  <div key={d.departmentId ?? "none"} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {fmtNumber(d.actualHours)} / {fmtNumber(d.targetHours)} h
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-muted-foreground/30"
                        style={{ width: `${targetPct}%` }}
                      />
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          d.actualHours >= d.targetHours ? "bg-success" : "bg-primary"
                        )}
                        style={{ width: `${actualPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top-5 Überstunden-Saldo (kein Abwesenheits-Pranger — absichtlich weggelassen) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 5 Überstunden-Saldo</CardTitle>
          <CardDescription>Größtes Plus-Konto (Saldo inkl. Anfangssaldo)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topOvertime.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Daten</p>
          ) : (
            <ul className="space-y-1.5">
              {data.topOvertime.map((u, i) => (
                <li key={u.userId} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/dashboard/zeitansicht?userId=${u.userId}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span className="font-mono text-xs text-muted-foreground w-4">{i + 1}.</span>
                    {u.name}
                  </Link>
                  <Badge variant={u.balanceHours >= 0 ? "default" : "destructive"} className="font-mono">
                    {u.balanceHours >= 0 ? "+" : ""}{fmtNumber(u.balanceHours)} h
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, delta, deltaHint, tone = "neutral",
}: {
  label: string;
  value: string;
  icon: typeof Clock;
  delta?: number | null;
  deltaHint?: string;
  tone?: "neutral" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    neutral: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className={cn("text-2xl font-semibold font-mono leading-tight", toneClass)}>{value}</p>
        {delta !== null && delta !== undefined && (
          <p className={cn("text-xs flex items-center gap-1", delta >= 0 ? "text-success" : "text-destructive")}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% {deltaHint ?? ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: Dashboard["monthlyTrend"] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Daten</p>;
  }

  const max = Math.max(...data.flatMap((d) => [d.actualHours, d.targetHours]), 100);
  const width = 100;
  const height = 40;
  const step = width / (data.length - 1 || 1);

  const actualPoints = data.map((d, i) => `${i * step},${height - (d.actualHours / max) * height}`).join(" ");
  const targetPoints = data.map((d, i) => `${i * step},${height - (d.targetHours / max) * height}`).join(" ");

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-32">
        <polyline
          points={targetPoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          strokeDasharray="1 1"
          className="text-muted-foreground/50"
        />
        <polyline
          points={actualPoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-primary"
        />
      </svg>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
        {data.map((d, i) => (
          <span key={i} className={i % 2 === 0 ? "" : "opacity-50"}>
            {MONTHS[d.month - 1]}
          </span>
        ))}
      </div>
    </div>
  );
}
