"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { format, differenceInCalendarDays, eachDayOfInterval, isWeekend } from "date-fns";
import { de } from "date-fns/locale";
import {
  CalendarRange, Clock3, FileText, Link2, Undo2, XCircle,
  CheckCircle2, CircleDashed, Hourglass, User,
} from "lucide-react";
import { REQUEST_TYPES, STATUS_LABELS, type RequestType } from "@/lib/request-types";
import { cn } from "@/lib/utils";

interface Approval {
  id: string;
  status: string;
  comment: string | null;
  decidedAt: string;
  approver?: { name: string } | null;
}

interface RequestDetail {
  id: string;
  userId: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  note: string | null;
  createdAt: string;
  relatedRequestId: string | null;
  approvals: Approval[];
}

interface VacationBalance {
  year: number;
  totalAvailable: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

interface Props {
  requestId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

function countWorkingDays(from: Date, to: Date): number {
  if (to < from) return 0;
  const days = eachDayOfInterval({ start: from, end: to });
  return days.filter((d) => !isWeekend(d)).length;
}

export function RequestDetailSheet({ requestId, onClose, onChanged }: Props) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [related, setRelated] = useState<RequestDetail | null>(null);
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);

  const isOpen = !!requestId;

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setRelated(null);
      setBalance(null);
      setCancelReason("");
      return;
    }
    setLoading(true);
    fetch("/api/requests")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.requests ?? []) as RequestDetail[];
        const found = list.find((r) => r.id === requestId) ?? null;
        setRequest(found);
        if (found?.relatedRequestId) {
          const rel = list.find((r) => r.id === found.relatedRequestId) ?? null;
          setRelated(rel);
        } else {
          setRelated(null);
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("Antrag konnte nicht geladen werden");
        setLoading(false);
      });
  }, [requestId]);

  useEffect(() => {
    if (!request || request.type !== "VACATION") {
      setBalance(null);
      return;
    }
    const year = new Date(request.dateFrom).getFullYear();
    fetch(`/api/me/vacation?year=${year}`)
      .then((r) => r.json())
      .then((d) => setBalance(d))
      .catch(() => setBalance(null));
  }, [request]);

  const typeInfo = request ? REQUEST_TYPES[request.type as RequestType] : null;
  const statusInfo = request ? STATUS_LABELS[request.status as keyof typeof STATUS_LABELS] : null;

  const workingDays = useMemo(() => {
    if (!request) return 0;
    return countWorkingDays(new Date(request.dateFrom), new Date(request.dateTo));
  }, [request]);

  const calendarDays = useMemo(() => {
    if (!request) return 0;
    return differenceInCalendarDays(new Date(request.dateTo), new Date(request.dateFrom)) + 1;
  }, [request]);

  const canWithdraw = request?.status === "PENDING";
  // Cancel button is shown for approved leave requests — including SICK,
  // which cancels directly without approval (matches the submission flow).
  const canCancel =
    request?.status === "APPROVED" &&
    ["VACATION", "HOMEOFFICE", "SPECIAL_LEAVE", "SICK"].includes(request.type) &&
    (request.type === "SICK" || new Date(request.dateFrom).getTime() > Date.now());
  const isSickCancel = request?.type === "SICK";

  async function handleWithdraw() {
    if (!request) return;
    setConfirmWithdraw(false);
    setBusy(true);
    const res = await fetch(`/api/requests/${request.id}/withdraw`, { method: "PATCH" });
    setBusy(false);
    if (!res.ok) {
      toast.error("Zurückziehen fehlgeschlagen");
      return;
    }
    toast.success("Antrag zurückgezogen");
    onChanged?.();
    onClose();
  }

  async function handleCancel() {
    if (!request) return;
    setConfirmCancel(false);
    setBusy(true);
    const res = await fetch(`/api/requests/${request.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Stornierung fehlgeschlagen");
      return;
    }
    toast.success(isSickCancel ? "Krankmeldung zurückgezogen" : "Stornierungsantrag eingereicht");
    onChanged?.();
    onClose();
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full !max-w-[min(100vw,42rem)] overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {loading ? (
                <Skeleton className="h-5 w-40" />
              ) : typeInfo ? (
                <>
                  <span className={cn("h-2.5 w-2.5 rounded-full", typeInfo.color)} />
                  {typeInfo.label}
                </>
              ) : (
                "Antrag"
              )}
              {statusInfo && (
                <Badge variant={statusInfo.variant} className="ml-2">
                  {statusInfo.label}
                </Badge>
              )}
            </SheetTitle>
            {request && (
              <p className="text-sm text-muted-foreground">
                Erstellt am {format(new Date(request.createdAt), "dd.MM.yyyy · HH:mm", { locale: de })}
              </p>
            )}
          </SheetHeader>

          <div className="flex-1 px-4 space-y-6">
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {!loading && request && (
              <>
                {/* Zeitraum */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <CalendarRange className="h-3.5 w-3.5" /> Zeitraum
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoCell label="Von" value={format(new Date(request.dateFrom), "EEEE, dd.MM.yyyy", { locale: de })} />
                    <InfoCell label="Bis" value={format(new Date(request.dateTo), "EEEE, dd.MM.yyyy", { locale: de })} />
                    <InfoCell label="Arbeitstage" value={`${workingDays} Tag${workingDays === 1 ? "" : "e"}`} />
                    <InfoCell label="Kalendertage" value={`${calendarDays} Tag${calendarDays === 1 ? "" : "e"}`} />
                  </div>
                </section>

                {/* VACATION balance */}
                {request.type === "VACATION" && balance && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Clock3 className="h-3.5 w-3.5" /> Urlaubskonto {balance.year}
                    </div>
                    <div className="rounded-lg border border-border p-4 text-sm space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gesamtanspruch</span>
                        <span className="font-mono">{balance.totalAvailable} Tage</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Genommen</span>
                        <span className="font-mono">{balance.usedDays} Tage</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ausstehend</span>
                        <span className="font-mono">{balance.pendingDays} Tage</span>
                      </div>
                      <div className="flex justify-between font-medium border-t border-border pt-1.5">
                        <span>Verbleibend</span>
                        <span className="font-mono">{balance.remainingDays} Tage</span>
                      </div>
                    </div>
                  </section>
                )}

                {/* Begründung */}
                {request.note && (
                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <FileText className="h-3.5 w-3.5" /> Begründung
                    </div>
                    <p className="text-sm rounded-lg border border-border bg-muted/20 p-3 whitespace-pre-wrap">
                      {request.note}
                    </p>
                  </section>
                )}

                {/* Verknüpfter Antrag */}
                {related && (
                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Link2 className="h-3.5 w-3.5" /> Verknüpfter Antrag
                    </div>
                    <div className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {REQUEST_TYPES[related.type as RequestType]?.label ?? related.type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(related.dateFrom), "dd.MM.yyyy", { locale: de })} –{" "}
                            {format(new Date(related.dateTo), "dd.MM.yyyy", { locale: de })}
                          </p>
                        </div>
                        <Badge variant={STATUS_LABELS[related.status as keyof typeof STATUS_LABELS]?.variant}>
                          {STATUS_LABELS[related.status as keyof typeof STATUS_LABELS]?.label ?? related.status}
                        </Badge>
                      </div>
                    </div>
                  </section>
                )}

                {/* Timeline */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Hourglass className="h-3.5 w-3.5" /> Verlauf
                  </div>
                  <Timeline request={request} />
                </section>
              </>
            )}
          </div>

          <SheetFooter className="gap-2 border-t border-border">
            {canWithdraw && (
              <Button
                variant="outline"
                onClick={() => setConfirmWithdraw(true)}
                disabled={busy}
                className="gap-2"
              >
                <Undo2 className="h-3.5 w-3.5" /> Zurückziehen
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                onClick={() => setConfirmCancel(true)}
                disabled={busy}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <XCircle className="h-3.5 w-3.5" /> Stornieren
              </Button>
            )}
            <Button onClick={onClose} variant={canWithdraw || canCancel ? "default" : "outline"}>
              Schließen
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Withdraw-Confirm */}
      <AlertDialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Antrag zurückziehen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Antrag wird endgültig zurückgezogen. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleWithdraw}>Zurückziehen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel-Confirm */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSickCancel ? "Krankmeldung zurückziehen?" : "Genehmigten Antrag stornieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isSickCancel
                ? "Die Krankmeldung wird sofort zurückgezogen — keine Genehmigung nötig."
                : "Die Stornierung muss von deinem Vorgesetzten genehmigt werden. Bitte gib einen Grund an."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            placeholder={isSickCancel ? "Grund (optional)..." : "Grund für die Stornierung..."}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>
              {isSickCancel ? "Zurückziehen" : "Stornierung einreichen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

function Timeline({ request }: { request: RequestDetail }) {
  type Step = {
    icon: typeof CheckCircle2;
    iconClass: string;
    title: string;
    timestamp: string;
    author?: string;
    comment?: string;
  };

  const steps: Step[] = [
    {
      icon: CircleDashed,
      iconClass: "text-muted-foreground",
      title: "Antrag erstellt",
      timestamp: request.createdAt,
    },
  ];

  for (const a of request.approvals ?? []) {
    const isApproved = a.status === "APPROVED";
    steps.push({
      icon: isApproved ? CheckCircle2 : XCircle,
      iconClass: isApproved ? "text-success" : "text-destructive",
      title: isApproved ? "Genehmigt" : "Abgelehnt",
      timestamp: a.decidedAt,
      author: a.approver?.name,
      comment: a.comment ?? undefined,
    });
  }

  if (request.status === "CANCELLED" && !request.approvals?.some((a) => a.status === "CANCELLED")) {
    steps.push({
      icon: XCircle,
      iconClass: "text-muted-foreground",
      title: "Storniert",
      timestamp: request.createdAt,
    });
  }

  return (
    <ol className="space-y-4 relative before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <li key={i} className="flex gap-3 relative">
            <div className="relative shrink-0 pt-0.5">
              <Icon className={cn("h-5 w-5 bg-background rounded-full", step.iconClass)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(step.timestamp), "dd.MM.yyyy · HH:mm", { locale: de })}
                {step.author && (
                  <>
                    {" · "}
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {step.author}
                    </span>
                  </>
                )}
              </p>
              {step.comment && (
                <p className="text-sm mt-1 rounded-md bg-muted/30 p-2 whitespace-pre-wrap">
                  {step.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
