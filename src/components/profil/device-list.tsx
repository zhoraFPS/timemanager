"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Smartphone, Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";

interface Device {
  id: string;
  deviceId: string;
  name: string | null;
  lastUsed: string;
  createdAt: string;
}

export function DeviceList() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me/devices");
      const data = await res.json();
      setDevices(data.devices ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    setDeleting(id);
    setConfirmId(null);
    const res = await fetch("/api/me/devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast.success("Gerät abgemeldet — bestehende Logins auf diesem Gerät werden ungültig");
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Abmelden fehlgeschlagen");
    }
    setDeleting(null);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Meine Geräte
          </CardTitle>
          <CardDescription>
            Alle Mobilgeräte, auf denen du angemeldet bist. Verlorene Geräte
            hier abmelden — bestehende App-Sessions werden ungültig.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : !devices || devices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Keine Mobilgeräte registriert.
            </p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Smartphone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {d.name ?? "Unbenanntes Gerät"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Zuletzt aktiv {formatDistanceToNow(new Date(d.lastUsed), { addSuffix: true, locale: de })}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 font-mono">
                        Hinzugefügt: {format(new Date(d.createdAt), "dd.MM.yyyy", { locale: de })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2 text-destructive hover:text-destructive"
                    disabled={deleting === d.id}
                    onClick={() => setConfirmId(d.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Abmelden
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => { if (!o) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerät abmelden?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Mobile-App auf diesem Gerät wird sofort abgemeldet. Außerdem werden
              **alle** anderen aktiven Mobile-Sessions deines Kontos beendet — du musst
              dich auf anderen Geräten neu einloggen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && handleDelete(confirmId)}>
              Abmelden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
