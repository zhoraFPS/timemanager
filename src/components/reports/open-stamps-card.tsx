"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ExternalLink, Hourglass } from "lucide-react";
import { toast } from "sonner";

interface OpenStamp {
  id: string;
  clockIn: string;
  type: string;
  ageHours: number;
  user: {
    id: string;
    name: string;
    employeeNumber: string | null;
    department: string | null;
  };
}

function fmtClockIn(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OpenStampsCard() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<OpenStamp[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<OpenStamp | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/admin/open-stamps?hours=2");
      const d = await r.json();
      setEntries(d.entries ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function closeStamp(entry: OpenStamp) {
    setClosingId(entry.id);
    try {
      const r = await fetch(`/api/admin/time-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clockOut: new Date().toISOString() }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Konnte Eintrag nicht schliessen");
      }
      toast.success(`Stempel von ${entry.user.name} geschlossen.`);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Schliessen");
    } finally {
      setClosingId(null);
      setConfirmTarget(null);
    }
  }

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Offene Stempel ({entries.length})
              </CardTitle>
              <CardDescription>
                Vergessene Aus-Stempelungen &gt; 2 Stunden. Jetzt auf aktuellen Zeitpunkt schliessen oder im Zeitansicht-Modul korrigieren.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                    <Hourglass className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{e.user.name}</span>
                      {e.user.department && (
                        <Badge variant="outline" className="text-xs">
                          {e.user.department}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {fmtClockIn(e.clockIn)} · seit {e.ageHours.toFixed(1)} h · {e.type}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/dashboard/zeitansicht?userId=${e.user.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Zeitansicht
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmTarget(e)}
                    disabled={closingId === e.id}
                  >
                    Jetzt schliessen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(o) => {
          if (!o) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stempel jetzt schliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget && (
                <>
                  Der offene Stempel von <strong>{confirmTarget.user.name}</strong> wird
                  auf den aktuellen Zeitpunkt geschlossen. Die Aenderung wird im
                  Audit-Log protokolliert.
                  <br />
                  <br />
                  Falls der Mitarbeiter zu einem anderen Zeitpunkt das Buero verlassen hat,
                  nutze stattdessen die Zeitansicht zur manuellen Korrektur.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTarget && closeStamp(confirmTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Jetzt schliessen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
