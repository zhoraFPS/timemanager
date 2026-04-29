"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Check, X, Clock, ArrowRight, User, CalendarDays, FileText } from "lucide-react";
import { STAMP_IN_TYPES, type StampInType } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface EditRequest {
  id: string;
  userId: string;
  timeEntryId: string;
  newType: string | null;
  newClockIn: string | null;
  newClockOut: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  timeEntry: {
    id: string;
    clockIn: string;
    clockOut: string | null;
    type: string;
  } | null;
  user: {
    id: string;
    name: string;
    employeeNumber: string | null;
    dept: { name: string } | null;
  } | null;
}

const STATUS_LABEL: Record<EditRequest["status"], string> = {
  PENDING: "Ausstehend",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
};

const STATUS_VARIANT: Record<EditRequest["status"], "secondary" | "default" | "destructive"> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
};

interface Props {
  highlightId?: string | null;
}

export function CorrectionRequests({ highlightId }: Props) {
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/time-entries/edit-requests");
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
    // Optimistic: mark status immediately
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status, reviewedAt: new Date().toISOString() } : r
      )
    );
    const res = await fetch(`/api/admin/time-entries/edit-request/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(status === "APPROVED" ? "Korrektur übernommen" : "Korrektur abgelehnt");
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
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Keine Zeitkorrektur-Anträge
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">{pending.length} ausstehend</Badge>
          {decided.length > 0 && (
            <span className="text-muted-foreground">
              · {decided.length} bereits bearbeitet
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
          <CardContent className="p-8 text-center text-muted-foreground">
            Keine ausstehenden Anträge
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((r) => (
            <CorrectionCard
              key={r.id}
              request={r}
              highlight={highlightId === r.id}
              onDecide={decide}
              acting={acting === r.id}
              refElement={highlightId === r.id ? highlightRef : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CorrectionCard({
  request,
  highlight,
  acting,
  onDecide,
  refElement,
}: {
  request: EditRequest;
  highlight: boolean;
  acting: boolean;
  onDecide: (id: string, status: "APPROVED" | "REJECTED") => void;
  refElement: React.RefObject<HTMLDivElement | null> | null;
}) {
  const original = request.timeEntry;
  const originalType = original?.type ?? "—";
  const originalTypeLabel = STAMP_IN_TYPES[originalType as StampInType]?.label ?? originalType;
  const newTypeLabel = request.newType
    ? STAMP_IN_TYPES[request.newType as StampInType]?.label ?? request.newType
    : null;

  return (
    <Card
      ref={refElement}
      className={cn(
        "transition-all flex flex-col",
        highlight && "ring-2 ring-primary shadow-lg",
        request.status !== "PENDING" && "opacity-70"
      )}
    >
      <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium truncate">{request.user?.name ?? "Unbekannt"}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {request.user?.employeeNumber && (
                <span className="font-mono">Nr. {request.user.employeeNumber}</span>
              )}
              {request.user?.dept && (
                <>
                  <span>·</span>
                  <span>{request.user.dept.name}</span>
                </>
              )}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
        </div>

        {original && (
          <div className="rounded-md border border-border p-3 text-sm space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(original.clockIn), "EEEE, dd.MM.yyyy", { locale: de })}
            </div>

            <DiffRow
              label="Typ"
              from={originalTypeLabel}
              to={newTypeLabel}
            />
            <DiffRow
              label="Kommen"
              from={format(new Date(original.clockIn), "HH:mm", { locale: de })}
              to={request.newClockIn ? format(new Date(request.newClockIn), "HH:mm", { locale: de }) : null}
            />
            <DiffRow
              label="Gehen"
              from={original.clockOut ? format(new Date(original.clockOut), "HH:mm", { locale: de }) : "—"}
              to={request.newClockOut ? format(new Date(request.newClockOut), "HH:mm", { locale: de }) : null}
            />
          </div>
        )}

        <div className="flex gap-2 items-start text-sm text-muted-foreground">
          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p className="whitespace-pre-wrap">{request.reason}</p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-auto">
          <Clock className="h-3 w-3" />
          <span>
            Gestellt {format(new Date(request.createdAt), "dd.MM.yyyy · HH:mm", { locale: de })}
          </span>
          {request.reviewedAt && (
            <>
              <span>·</span>
              <span>Entschieden {format(new Date(request.reviewedAt), "dd.MM.yyyy", { locale: de })}</span>
            </>
          )}
        </div>

        {request.status === "PENDING" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onDecide(request.id, "APPROVED")}
              disabled={acting}
              className="flex-1 bg-success hover:bg-success/80 text-white"
            >
              <Check className="h-4 w-4 mr-1" /> Übernehmen
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDecide(request.id, "REJECTED")}
              disabled={acting}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-1" /> Ablehnen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiffRow({ label, from, to }: { label: string; from: string; to: string | null }) {
  const changed = to !== null && to !== from;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <span className={cn(changed ? "line-through text-muted-foreground" : "font-medium")}>
        {from}
      </span>
      {changed && (
        <>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium text-primary">{to}</span>
        </>
      )}
    </div>
  );
}
