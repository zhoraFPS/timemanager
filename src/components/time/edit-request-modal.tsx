"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAMP_IN_TYPES, type StampInType } from "@/lib/stamp-types";
import { format } from "date-fns";
import { CheckCircle2, Clock, Ban } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: TimeEntry | null;
}

type CorrectionMode = "direct" | "request" | "blocked";

function entryAgeDays(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function toTimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditRequestModal({ open, onClose, onSuccess, entry }: Props) {
  // Policy
  const [directDays, setDirectDays] = useState(3);
  const [maxDays, setMaxDays] = useState(7);
  const [policyLoaded, setPolicyLoaded] = useState(false);

  // Form
  const [newType, setNewType] = useState<StampInType | "">("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load policy + prefill form on open
  useEffect(() => {
    if (!open || !entry) return;
    setError(null);
    setReason("");
    setNewType(entry.type as StampInType);
    setClockIn(toTimeValue(entry.clockIn));
    setClockOut(entry.clockOut ? toTimeValue(entry.clockOut) : "");

    fetch("/api/time-entries/correction-policy")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.directCorrectionDays === "number") setDirectDays(d.directCorrectionDays);
        if (typeof d.maxCorrectionDays === "number") setMaxDays(d.maxCorrectionDays);
      })
      .catch(() => {})
      .finally(() => setPolicyLoaded(true));
  }, [open, entry]);

  if (!entry) return null;

  const age = entryAgeDays(entry.clockIn);
  const mode: CorrectionMode =
    age <= directDays ? "direct" : age <= maxDays ? "request" : "blocked";

  const originalIn = toTimeValue(entry.clockIn);
  const originalOut = entry.clockOut ? toTimeValue(entry.clockOut) : "";
  const typeChanged = newType !== entry.type;
  const inChanged = clockIn !== originalIn;
  const outChanged = clockOut !== originalOut;
  const hasChanges = typeChanged || inChanged || outChanged;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry || mode === "blocked") return;
    if (!hasChanges) {
      setError("Keine Aenderungen vorgenommen.");
      return;
    }
    if (mode === "request" && !reason.trim()) {
      setError("Bitte gib einen Grund an.");
      return;
    }

    const dateStr = format(new Date(entry.clockIn), "yyyy-MM-dd");
    const payload: Record<string, unknown> = { timeEntryId: entry.id };
    if (typeChanged) payload.newType = newType;
    if (inChanged) payload.newClockIn = `${dateStr}T${clockIn}:00`;
    if (outChanged) payload.newClockOut = clockOut ? `${dateStr}T${clockOut}:00` : null;

    const url =
      mode === "direct" ? "/api/time-entries/direct-edit" : "/api/time-entries/edit-request";
    const method = mode === "direct" ? "PATCH" : "POST";

    if (mode === "request") payload.reason = reason.trim();

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Speichern");
      }
      toast.success(
        mode === "direct"
          ? "Eintrag aktualisiert."
          : "Korrekturantrag an Vorgesetzten gesendet.",
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[min(100vw,32rem)]">
        <DialogHeader>
          <DialogTitle>Eintrag korrigieren</DialogTitle>
          <DialogDescription>
            {format(new Date(entry.clockIn), "EEEE, dd.MM.yyyy")} —{" "}
            {STAMP_IN_TYPES[entry.type as StampInType]?.label ?? entry.type}
          </DialogDescription>
        </DialogHeader>

        {policyLoaded && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
              mode === "direct" && "border-success/40 bg-success/10 text-success",
              mode === "request" && "border-primary/40 bg-primary/10 text-primary",
              mode === "blocked" && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {mode === "direct" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Direkte Korrektur · wird sofort gespeichert (bis {directDays} Tage rueckwirkend)
              </>
            )}
            {mode === "request" && (
              <>
                <Clock className="h-3.5 w-3.5" />
                Korrekturantrag · dein Vorgesetzter muss genehmigen (bis {maxDays} Tage)
              </>
            )}
            {mode === "blocked" && (
              <>
                <Ban className="h-3.5 w-3.5" />
                Korrektur nicht mehr moeglich (Eintrag ist aelter als {maxDays} Tage)
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={mode === "blocked"} className="space-y-4">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as StampInType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Typ auswaehlen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAMP_IN_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kommenzeit</Label>
                <Input
                  type="time"
                  value={clockIn}
                  onChange={(e) => setClockIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gehzeit</Label>
                <Input
                  type="time"
                  value={clockOut}
                  onChange={(e) => setClockOut(e.target.value)}
                  placeholder="Noch offen"
                />
              </div>
            </div>

            {mode === "request" && (
              <div className="space-y-2">
                <Label>Begruendung *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Was soll korrigiert werden und warum?"
                />
              </div>
            )}
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                mode === "blocked" ||
                !hasChanges ||
                (mode === "request" && !reason.trim())
              }
            >
              {loading
                ? "Speichern…"
                : mode === "direct"
                  ? "Aenderung speichern"
                  : "Antrag stellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
