"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, X, UserRound } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  formatAuditEntry,
  ACTION_LABELS,
  ACTION_TONES,
  type AuditLogEntry,
} from "@/lib/audit-format";

type AuditEntry = AuditLogEntry;

const RESOURCES = [
  { value: "__all__", label: "Alle Ressourcen" },
  { value: "TimeEntry", label: "Zeitbuchungen" },
  { value: "Request", label: "Anträge" },
  { value: "User", label: "Benutzer" },
  { value: "Role", label: "Rollen" },
  { value: "SystemConfig", label: "Einstellungen" },
];

interface EmployeeOption { id: string; name: string; employeeNumber: string | null }

export function AuditLogClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("employeeId");

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [resourceFilter, setResourceFilter] = useState("__all__");

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [subject, setSubject] = useState<EmployeeOption | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        const raw = (d.users ?? []) as EmployeeOption[];
        setEmployees(raw);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (employeeId && employees.length > 0) {
      const match = employees.find((e) => e.id === employeeId);
      if (match) setSubject(match);
    } else if (!employeeId) {
      setSubject(null);
    }
  }, [employeeId, employees]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (resourceFilter !== "__all__") params.set("resource", resourceFilter);
      if (employeeId) params.set("employeeId", employeeId);
      const res = await fetch(`/api/admin/audit-log?${params}`);
      // Guard against non-JSON error responses (middleware redirect, 500 with
      // empty body, etc.) — any of those used to throw an unhelpful parse err.
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        console.error("[audit-log] request failed", res.status, data);
        setLogs([]);
        setTotalPages(1);
        setTotal(0);
        return;
      }
      setLogs(data.logs ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("[audit-log] fetch error", err);
      setLogs([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, resourceFilter, employeeId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function selectEmployee(id: string) {
    const params = new URLSearchParams(searchParams);
    if (id && id !== "__all__") params.set("employeeId", id);
    else params.delete("employeeId");
    router.push(`/dashboard/audit-log${params.toString() ? `?${params}` : ""}`);
    setPage(1);
  }

  function clearSubject() {
    selectEmployee("__all__");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {subject ? `Audit-Log: ${subject.name}` : "Audit-Log"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {subject
            ? `Alle Aktivitaeten von und zu ${subject.name} · ${total} Eintraege`
            : `Alle Systemaktivitaeten und Aenderungen — ${total} Eintraege`}
        </p>
      </div>

      {subject && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <UserRound className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Gefiltert auf <strong>{subject.name}</strong>
                {subject.employeeNumber && (
                  <span className="text-muted-foreground font-normal"> · Nr. {subject.employeeNumber}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Zeigt alle Ereignisse die von oder für diese Person geschehen sind.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearSubject} className="gap-2">
              <X className="h-3.5 w-3.5" /> Filter entfernen
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v ?? "__all__"); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RESOURCES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={subject?.id ?? "__all__"}
          onValueChange={(v) => selectEmployee(v ?? "__all__")}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Alle Mitarbeiter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Mitarbeiter</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
                {e.employeeNumber ? ` (Nr. ${e.employeeNumber})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-96" />
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Keine Audit-Log-Eintraege vorhanden
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aktivitaeten</CardTitle>
            <CardDescription>Seite {page} von {totalPages}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log) => {
                const f = formatAuditEntry(log);
                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 border border-border rounded-md">
                    <Badge className={`shrink-0 text-xs border ${ACTION_TONES[log.action] ?? "bg-muted text-foreground border-border"}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium">{f.headline}</p>
                      {f.details.length > 0 && (
                        <ul className="text-sm text-muted-foreground space-y-0.5">
                          {f.details.map((d, i) => (
                            <li key={i}>· {d}</li>
                          ))}
                        </ul>
                      )}
                      <p className="text-xs text-muted-foreground/70 font-mono pt-0.5">
                        {format(new Date(log.createdAt), "dd.MM.yyyy · HH:mm:ss", { locale: de })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Zurueck
                </Button>
                <span className="text-sm text-muted-foreground">
                  Seite {page} von {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Weiter<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
