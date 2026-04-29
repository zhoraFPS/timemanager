"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInCalendarDays, eachDayOfInterval, isWeekend } from "date-fns";
import { de } from "date-fns/locale";
import { REQUEST_TYPES } from "@/lib/request-types";
import { Check, X, CalendarRange, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Request {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  note: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

interface Props {
  highlightRequestId?: string | null;
}

function countWorkingDays(from: Date, to: Date): number {
  if (to < from) return 0;
  return eachDayOfInterval({ start: from, end: to }).filter((d) => !isWeekend(d)).length;
}

export function ApprovalList({ highlightRequestId }: Props) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  async function fetchRequests() {
    const res = await fetch("/api/team/requests");
    const data = await res.json();
    setRequests(data.requests ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  // Scroll highlighted request into view once loaded
  useEffect(() => {
    if (!loading && highlightRequestId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightRequestId, requests]);

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setActing(id);
    // Optimistic removal — the card disappears the moment the manager clicks.
    const snapshot = requests;
    setRequests((prev) => prev.filter((r) => r.id !== id));

    const res = await fetch(`/api/requests/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment: comments[id] ?? "" }),
    });

    if (res.ok) {
      toast.success(status === "APPROVED" ? "Antrag genehmigt" : "Antrag abgelehnt");
      // Background re-fetch to stay in sync if anything changed concurrently.
      fetchRequests();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Aktion fehlgeschlagen");
      // Rollback the optimistic removal.
      setRequests(snapshot);
    }
    setActing(null);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52" />)}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Keine offenen Anträge
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {requests.map((req) => {
        const typeInfo = REQUEST_TYPES[req.type as keyof typeof REQUEST_TYPES];
        const from = new Date(req.dateFrom);
        const to = new Date(req.dateTo);
        const workingDays = countWorkingDays(from, to);
        const calendarDays = differenceInCalendarDays(to, from) + 1;
        const isHighlight = highlightRequestId === req.id;

        return (
          <Card
            key={req.id}
            ref={isHighlight ? highlightRef : undefined}
            className={cn(
              "transition-all flex flex-col",
              isHighlight && "ring-2 ring-primary shadow-lg"
            )}
          >
            <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", typeInfo?.color ?? "bg-muted")} />
                    <p className="font-medium">{typeInfo?.label ?? req.type}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <User className="h-3.5 w-3.5" />
                    <span className="truncate">{req.user.name}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">Ausstehend</Badge>
              </div>

              <div className="rounded-md border border-border p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarRange className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">
                    {format(from, "dd.MM.yyyy", { locale: de })} – {format(to, "dd.MM.yyyy", { locale: de })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {workingDays} Arbeitstag{workingDays === 1 ? "" : "e"} · {calendarDays} Kalendertag{calendarDays === 1 ? "" : "e"}
                </p>
              </div>

              {req.note && (
                <p className="text-sm rounded-md bg-muted/30 p-3 whitespace-pre-wrap">
                  {req.note}
                </p>
              )}

              <div className="flex-1" />

              <Textarea
                placeholder="Kommentar (optional)"
                rows={2}
                value={comments[req.id] ?? ""}
                onChange={(e) =>
                  setComments((c) => ({ ...c, [req.id]: e.target.value }))
                }
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => decide(req.id, "APPROVED")}
                  disabled={acting === req.id}
                  className="flex-1 bg-success hover:bg-success/80 text-white"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Genehmigen
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => decide(req.id, "REJECTED")}
                  disabled={acting === req.id}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  Ablehnen
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
