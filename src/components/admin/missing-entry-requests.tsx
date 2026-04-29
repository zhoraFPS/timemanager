"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { Check, X, Clock, User as UserIcon, CalendarDays, FileText } from "lucide-react";
import { STAMP_IN_TYPES, type StampInType } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface MissingRequest {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
  reason: string;
  status: Status;
  createdAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    employeeNumber: string | null;
    dept: { name: string } | null;
  } | null;
}

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Ausstehend",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
};

const STATUS_VARIANT: Record<Status, "secondary" | "default" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

interface Props {
  highlightId?: string | null;
}

function fmtDuration(a: string, b: string | null): string {
  if (!b) return "—";
  const mins = Math.max(0, differenceInMinutes(new Date(b), new Date(a)));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}min`;
}

export function MissingEntryRequests({ highlightId }: Props) {
  const [requests, setRequests] = useState<MissingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/time-entries/missing-request");
      const data = await res.json();
      setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!loading && highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightId, requests]);

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setActing(id);
    const snapshot = requests;
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, reviewedAt: new Date().toISOString() } : r
      )
    );
    const res = await fetch(`/api/admin/time-entries/missing-request/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(status === "APPROVED" ? "Eintrag angelegt" : "Antrag abgelehnt");
      fetchRequests();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Aktion fehlgeschlagen");
      setRequests(snapshot);
    }
    setActing(null);
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");
  const list = showAll ? requests : pending;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => <Skeleton key={i} className="h-52" />)}
      </div>
    );
  }

  if (requests.length === 0) {
    return null; // Hidden when no requests — avoid empty section noise
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <h2 className="font-semibold">Nachgetragene Einträge</h2>
          <Badge variant="secondary">{pending.length} ausstehend</Badge>
          {decided.length > 0 && (
            <span className="text-muted-foreground text-xs">
              · {decided.length} bearbeitet
            </span>
          )}
        </div>
        {decided.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAll ? "Nur ausstehende" : "Alle anzeigen"}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            Keine ausstehenden Anträge
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((r) => (
            <Card
              key={r.id}
              ref={highlightId === r.id ? highlightRef : null}
              className={cn(
                "transition-all flex flex-col",
                highlightId === r.id && "ring-2 ring-primary shadow-lg",
                r.status !== "PENDING" && "opacity-70"
              )}
            >
              <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.user?.name ?? "Unbekannt"}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {r.user?.employeeNumber && (
                        <span className="font-mono">Nr. {r.user.employeeNumber}</span>
                      )}
                      {r.user?.dept && (
                        <>
                          <span>·</span>
                          <span>{r.user.dept.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </div>

                <div className="rounded-md border border-border p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(new Date(r.clockIn), "EEEE, dd.MM.yyyy", { locale: de })}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {STAMP_IN_TYPES[r.type as StampInType]?.label ?? r.type}
                    </Badge>
                    <span className="text-sm font-mono">
                      {format(new Date(r.clockIn), "HH:mm", { locale: de })}
                      {r.clockOut && ` – ${format(new Date(r.clockOut), "HH:mm", { locale: de })}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {fmtDuration(r.clockIn, r.clockOut)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 items-start text-sm text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p className="whitespace-pre-wrap">{r.reason}</p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-auto">
                  <Clock className="h-3 w-3" />
                  Gestellt {format(new Date(r.createdAt), "dd.MM.yyyy · HH:mm", { locale: de })}
                  {r.reviewedAt && (
                    <>
                      <span>·</span>
                      <span>Entschieden {format(new Date(r.reviewedAt), "dd.MM.yyyy", { locale: de })}</span>
                    </>
                  )}
                </div>

                {r.status === "PENDING" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => decide(r.id, "APPROVED")}
                      disabled={acting === r.id}
                      className="flex-1 bg-success hover:bg-success/80 text-white"
                    >
                      <Check className="h-4 w-4 mr-1" /> Eintrag anlegen
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide(r.id, "REJECTED")}
                      disabled={acting === r.id}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-1" /> Ablehnen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
