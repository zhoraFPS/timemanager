"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STAMP_IN_TYPES, type StampInType } from "@/lib/stamp-types";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Trash2 } from "lucide-react";

interface ExistingEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
}

/**
 * Two modes, picked from props:
 *   - edit:   `entry` set → PATCH /api/admin/time-entries/[id]
 *   - create: `entry` null, `userId` + `day` set → POST /api/admin/time-entries
 * Both paths are audit-logged server-side.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: ExistingEntry | null;
  userId?: string;
  day?: Date | null;
}

export function HrEditModal({ open, onClose, onSuccess, entry, userId, day }: Props) {
  const isCreate = !entry;
  const [newType, setNewType] = useState<StampInType>("WORK");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (entry) {
      setNewType(entry.type as StampInType);
      setClockIn(format(new Date(entry.clockIn), "HH:mm"));
      setClockOut(entry.clockOut ? format(new Date(entry.clockOut), "HH:mm") : "");
    } else {
      setNewType("WORK");
      setClockIn("09:00");
      setClockOut("17:00");
    }
  }, [entry, open]);

  const refDate = entry ? new Date(entry.clockIn) : day ?? null;
  const dateStr = refDate ? format(refDate, "yyyy-MM-dd") : null;

  async function handleSave() {
    if (!dateStr) return;
    if (!clockIn) {
      toast.error("Kommen-Zeit fehlt");
      return;
    }
    setSaving(true);
    const body = {
      type: newType,
      clockIn: `${dateStr}T${clockIn}:00`,
      clockOut: clockOut ? `${dateStr}T${clockOut}:00` : null,
    };
    const res = await fetch(
      isCreate ? "/api/admin/time-entries" : `/api/admin/time-entries/${entry!.id}`,
      {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isCreate ? { ...body, userId } : body),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? (isCreate ? "Erstellen fehlgeschlagen" : "Korrektur fehlgeschlagen"));
      return;
    }
    toast.success(isCreate ? "Eintrag angelegt" : "Eintrag korrigiert");
    onSuccess();
    onClose();
  }

  async function handleDelete() {
    if (!entry) return;
    setConfirmDelete(false);
    setSaving(true);
    const res = await fetch(`/api/admin/time-entries/${entry.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Löschen fehlgeschlagen");
      return;
    }
    toast.success("Eintrag gelöscht");
    onSuccess();
    onClose();
  }

  if (!open || !refDate) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isCreate ? "Eintrag anlegen (HR)" : "Eintrag korrigieren (HR)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {format(refDate, "EEEE, dd.MM.yyyy", { locale: de })}
            </p>
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select
                value={newType}
                onValueChange={(v) => setNewType(v as StampInType)}
              >
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
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
              {isCreate
                ? "Der Eintrag wird neu angelegt und im Audit-Log protokolliert."
                : "Diese Korrektur wird sofort angewandt und im Audit-Log protokolliert."}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {!isCreate ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive gap-2"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                <Trash2 className="h-3.5 w-3.5" /> Löschen
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving
                  ? "Wird gespeichert..."
                  : isCreate
                    ? "Eintrag anlegen"
                    : "Korrektur speichern"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Zeitbuchung wird endgültig entfernt. Diese Aktion wird im Audit-Log protokolliert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
