"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Users,
  Palmtree,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  employeeNumber: string;
  contractType: string;
  saldoMins: number;
  vacationTotal: number;
  vacationUsed: number;
  vacationPending: number;
  vacationRemaining: number;
}

type SortField = "name" | "department" | "saldo" | "vacation";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Contract type labels
// ---------------------------------------------------------------------------

const CONTRACT_LABELS: Record<string, string> = {
  FULLTIME: "Vollzeit",
  PARTTIME: "Teilzeit",
  MINI: "Minijob",
  INTERN: "Praktikant",
  WORKING_STUDENT: "Werkstudent",
};

// ---------------------------------------------------------------------------
// Time filter presets
// ---------------------------------------------------------------------------

const TIME_PRESETS = [
  { value: "none", label: "Kein Zeitfilter" },
  { value: "over10plus", label: "> 10h Überstunden" },
  { value: "over20plus", label: "> 20h Überstunden" },
  { value: "over10minus", label: "> 10h Minusstunden" },
  { value: "over20minus", label: "> 20h Minusstunden" },
  { value: "over5vacation", label: "< 5 Urlaubstage übrig" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSaldo(mins: number): string {
  const sign = mins >= 0 ? "+" : "-";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}h`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeeOverview() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [timePreset, setTimePreset] = useState("none");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    fetch("/api/admin/employees/overview")
      .then((r) => r.json())
      .then((d) => {
        setEmployees(d.employees ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Unique departments for filter dropdown
  const departments = useMemo(
    () =>
      Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort(),
    [employees]
  );

  // Unique contract types
  const contractTypes = useMemo(
    () =>
      Array.from(new Set(employees.map((e) => e.contractType).filter(Boolean))).sort(),
    [employees]
  );

  // Apply filters
  const filtered = useMemo(() => {
    let result = employees;

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.employeeNumber.toLowerCase().includes(q)
      );
    }

    // Department
    if (deptFilter !== "all") {
      result = result.filter((e) => e.department === deptFilter);
    }

    // Contract type
    if (contractFilter !== "all") {
      result = result.filter((e) => e.contractType === contractFilter);
    }

    // Time preset
    if (timePreset !== "none") {
      result = result.filter((e) => {
        const hours = e.saldoMins / 60;
        switch (timePreset) {
          case "over10plus":
            return hours > 10;
          case "over20plus":
            return hours > 20;
          case "over10minus":
            return hours < -10;
          case "over20minus":
            return hours < -20;
          case "over5vacation":
            return e.vacationRemaining < 5;
          default:
            return true;
        }
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "department":
          cmp = (a.department || "").localeCompare(b.department || "");
          break;
        case "saldo":
          cmp = a.saldoMins - b.saldoMins;
          break;
        case "vacation":
          cmp = a.vacationRemaining - b.vacationRemaining;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [employees, search, deptFilter, contractFilter, timePreset, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // Stats
  const totalOvertime = employees.filter((e) => e.saldoMins > 10 * 60).length;
  const totalUndertime = employees.filter((e) => e.saldoMins < -10 * 60).length;
  const totalLowVacation = employees.filter((e) => e.vacationRemaining < 5).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card size="sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{employees.length}</p>
              <p className="text-xs text-muted-foreground">Mitarbeiter gesamt</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalOvertime}</p>
              <p className="text-xs text-muted-foreground">&gt; 10h Überstunden</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalUndertime}</p>
              <p className="text-xs text-muted-foreground">&gt; 10h Minusstunden</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, E-Mail oder Personalnr."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* Department */}
            <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v ?? "all")}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Abteilung" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Abteilungen</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Contract type */}
            <Select value={contractFilter} onValueChange={(v) => setContractFilter(v ?? "all")}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Vertragsart" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Verträge</SelectItem>
                {contractTypes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CONTRACT_LABELS[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Time preset */}
            <Select value={timePreset} onValueChange={(v) => setTimePreset(v ?? "none")}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Zeitfilter" />
              </SelectTrigger>
              <SelectContent>
                {TIME_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Result count */}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filtered.length} von {employees.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <SortHeader
                    label="Mitarbeiter"
                    field="name"
                    current={sortField}
                    dir={sortDir}
                    onToggle={toggleSort}
                  />
                  <SortHeader
                    label="Abteilung"
                    field="department"
                    current={sortField}
                    dir={sortDir}
                    onToggle={toggleSort}
                  />
                  <th className="py-3 px-4 text-xs font-medium text-muted-foreground">
                    Vertrag
                  </th>
                  <SortHeader
                    label="Gleitzeitkonto"
                    field="saldo"
                    current={sortField}
                    dir={sortDir}
                    onToggle={toggleSort}
                    className="text-right"
                  />
                  <SortHeader
                    label="Resturlaub"
                    field="vacation"
                    current={sortField}
                    dir={sortDir}
                    onToggle={toggleSort}
                    className="text-right"
                  />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      Keine Mitarbeiter gefunden
                    </td>
                  </tr>
                ) : (
                  filtered.map((emp) => {
                    const saldoHours = emp.saldoMins / 60;
                    const saldoSeverity =
                      saldoHours < -20
                        ? "critical-minus"
                        : saldoHours < -10
                          ? "warn-minus"
                          : saldoHours > 20
                            ? "warn-plus"
                            : saldoHours > 10
                              ? "info-plus"
                              : "normal";

                    return (
                      <tr
                        key={emp.id}
                        className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                      >
                        {/* Name */}
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp.employeeNumber && `#${emp.employeeNumber} · `}
                            {emp.email}
                          </p>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-4 text-sm">
                          {emp.department || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Contract */}
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-xs">
                            {CONTRACT_LABELS[emp.contractType] ?? emp.contractType}
                          </Badge>
                        </td>

                        {/* Saldo */}
                        <td className="py-3 px-4 text-right">
                          <span
                            className={cn(
                              "text-sm font-mono font-medium",
                              saldoSeverity === "critical-minus" && "text-destructive",
                              saldoSeverity === "warn-minus" && "text-destructive/80",
                              saldoSeverity === "warn-plus" && "text-warning",
                              saldoSeverity === "info-plus" && "text-success",
                              saldoSeverity === "normal" && "text-foreground"
                            )}
                          >
                            {formatSaldo(emp.saldoMins)}
                          </span>
                        </td>

                        {/* Vacation */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={cn(
                                "text-sm font-medium",
                                emp.vacationRemaining < 5 && "text-warning"
                              )}
                            >
                              {emp.vacationRemaining}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              / {emp.vacationTotal}
                            </span>
                            {emp.vacationPending > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-warning border-warning/40"
                              >
                                {emp.vacationPending} offen
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort header helper
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  field,
  current,
  dir,
  onToggle,
  className,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onToggle: (f: SortField) => void;
  className?: string;
}) {
  const active = current === field;
  return (
    <th className={cn("py-3 px-4", className)}>
      <button
        onClick={() => onToggle(field)}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3",
            active ? "text-primary" : "text-muted-foreground/50"
          )}
        />
        {active && (
          <span className="text-[10px] text-primary">
            {dir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}
