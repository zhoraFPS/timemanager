"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { REQUEST_TYPES, STATUS_LABELS } from "@/lib/request-types";
import { cn } from "@/lib/utils";
import { RequestDetailSheet } from "@/components/requests/request-detail-sheet";

interface Request {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface RequestListProps {
  refreshKey: number;
  initialRequestId?: string | null;
  /** An optimistically-added request that should appear immediately. */
  optimistic?: Request | null;
}

export function RequestList({
  refreshKey,
  initialRequestId,
  optimistic,
}: RequestListProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  // Only block UI on the very first load. Later re-fetches run in the
  // background so the list keeps showing current data (no flicker).
  const [initialLoading, setInitialLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(initialRequestId ?? null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/requests")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRequests(d.requests ?? []);
        setInitialLoading(false);
      })
      .catch(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey, localRefresh]);

  useEffect(() => {
    if (initialRequestId) setOpenId(initialRequestId);
  }, [initialRequestId]);

  // Merge the optimistic item at the top. Once the real fetch returns, it
  // will already contain the same id and replace the optimistic entry.
  const merged =
    optimistic && !requests.some((r) => r.id === optimistic.id)
      ? [optimistic, ...requests]
      : requests;

  if (initialLoading && merged.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (merged.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Keine Anträge vorhanden
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {merged.map((req) => {
          const typeInfo = REQUEST_TYPES[req.type as keyof typeof REQUEST_TYPES];
          const statusInfo = STATUS_LABELS[req.status as keyof typeof STATUS_LABELS];
          return (
            <Card
              key={req.id}
              className="transition-colors hover:border-primary/40 cursor-pointer"
            >
              <button
                type="button"
                onClick={() => setOpenId(req.id)}
                className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", typeInfo?.color ?? "bg-muted")} />
                    <div className="min-w-0">
                      <p className="font-medium">{typeInfo?.label ?? req.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(req.dateFrom), "dd.MM.yyyy", { locale: de })}
                        {" – "}
                        {format(new Date(req.dateTo), "dd.MM.yyyy", { locale: de })}
                      </p>
                      {req.note && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">{req.note}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusInfo?.variant}>
                      {statusInfo?.label ?? req.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </button>
            </Card>
          );
        })}
      </div>

      <RequestDetailSheet
        requestId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => setLocalRefresh((k) => k + 1)}
      />
    </>
  );
}
