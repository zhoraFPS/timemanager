"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STAMP_IN_TYPES, type StampInType } from "@/lib/stamp-types";
import { format, differenceInCalendarDays } from "date-fns";
import { de } from "date-fns/locale";
import { Info, Send } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** The day the employee wants to backfill. */
  day: Date | null;
}

interface Policy {
  directCorrectionDays: number;
  maxCorrectionDays: number;
}

/**
 * Employees add a forgotten stamp via this dialog. Policy is fetched once and
 * decides whether the submission is applied directly (within the grace window)
 * or routed to HR as an approval request.
 */
export function EmployeeBackfillModal({ open, onClose, onSuccess, day }: Props) {
  const [type, setType] = useState<StampInType>("WORK");
  const [clockIn, setClockIn] = useState("09:00");
  const [clockOut, setClockOut] = useState("17:00");
  const [reason, setReason] = useState("");
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/time-entries/correction-policy")
      .then((r) => r.json())
      .then((d) => setPolicy(d))
      .catch(() => setPolicy({ directCorrectionDays: 3, maxCorrectionDays: 0 }));
  }, [open]);

  useEffect(() => {
    if (open) {
      setType("WORK");
      setClockIn("09:00");
      setClockOut("17:00");
      setReason("");
    }
  }, [open, day]);

  if (!day) return null;

  const ageDays = Math.max(0, differenceInCalendarDays(new Date(), day));
  const directDays = policy?.directCorrectionDays ?? 3;
  const maxDays = policy?.maxCorrectionDays ?? 0;
  const isDirect = ageDays <= directDays;
  const beyondMax = maxDays > 0 && ageDays > maxDays;

  async function handleSubmit() {
    if (!day) return;
    if (!isDirect && !reason.trim()) {
      toast.error("Begründung ist erforderlich");
      return;
    }
    setSaving(true);
    const dateStr = format(day, "yyyy-MM-dd");
    const res = await fetch("/api/time-entries/create-missing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clockIn: `${dateStr}T${clockIn}:00`,
        clockOut: clockOut ? `${dateStr}T${clockOut}:00` : undefined,
        type,
        reason: reason.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Nachstempelung fehlgeschlagen");
      return;
    }
    const data = await res.json();
    toast.success(
      data.mode === "direct"
        ? "Eintrag angelegt"
        : "Antrag an HR gesendet"
    );
    onSuccess();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isDirect ? "Nachträglich stempeln" : "Nachtragung beantragen"}
          </DialogTitle>
          <DialogDescription>
            {format(day, "EEEE, dd.MM.yyyy", { locale: de })}
            {ageDays > 0 && ` · vor ${ageDays} Tag${ageDays === 1 ? "" : "en"}`}
          </DialogDescription>
        </DialogHeader>

        {beyondMax ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            Nachträgliche Einträge sind maximal {maxDays} Tage rückwirkend möglich.
            Bitte wende dich an HR für eine direkte Korrektur.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stempelart</Label>
              <Select value={type} onValueChange={(v) => setType(v as StampInType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAMP_IN_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kommen</Label>
                <Input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Gehen</Label>
                <Input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
              </div>
            </div>

            {!isDirect && (
              <div className="space-y-2">
                <Label>Begründung *</Label>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Warum wurde nicht rechtzeitig gestempelt?"
                  required
                />
              </div>
            )}

            <div className={
              isDirect
                ? "rounded-md border border-success/40 bg-success/5 p-3 text-xs flex gap-2 items-start"
                : "rounded-md border border-primary/40 bg-primary/5 p-3 text-xs flex gap-2 items-start"
            }>
              {isDirect ? (
                <Info className="h-4 w-4 text-success shrink-0 mt-0.5" />
              ) : (
                <Send className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-medium text-sm">
                  {isDirect
                    ? "Sofortige Übernahme"
                    : "Antrag an HR"}
                </p>
                <p>
                  {isDirect
                    ? `Noch innerhalb der ${directDays}-Tage-Frist — wird direkt gespeichert, keine Genehmigung nötig.`
                    : `Außerhalb der ${directDays}-Tage-Frist — wird an HR zur Genehmigung geschickt.`}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving || beyondMax}>
            {saving
              ? "Wird gesendet..."
              : isDirect
                ? "Eintrag anlegen"
                : "Antrag stellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
