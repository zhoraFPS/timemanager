"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, FolderKanban, WifiOff } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { de } from "date-fns/locale";
import { STAMP_IN_TYPES, STAMP_OUT_TYPE, type StampInType } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  code: string;
  color: string | null;
  isActive: boolean;
}

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
}

export function ClockWidget() {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("none");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  const fetchActive = useCallback(async () => {
    const res = await fetch("/api/time-entries/active");
    const data = await res.json();
    setActiveEntry(data.entry ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchActive(); }, [fetchActive]);

  useEffect(() => {
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((d) => setProjects((d as Project[]).filter((p) => p.isActive)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleStamp(type: string) {
    setActing(type);
    const payload: Record<string, string | null> = { type };
    if (type !== STAMP_OUT_TYPE && selectedProject !== "none") {
      payload.projectId = selectedProject;
    }
    const res = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) await fetchActive();
    setActing(null);
  }

  const elapsed = activeEntry && now
    ? differenceInSeconds(now, new Date(activeEntry.clockIn))
    : 0;
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const elapsedStr = `${hh}:${mm}:${ss}`;

  const activeType = activeEntry?.type as StampInType | undefined;
  const activeInfo = activeType ? STAMP_IN_TYPES[activeType] : null;

  return (
    <Card className="col-span-2">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-mono">
            {now ? format(now, "EEEE, dd. MMMM yyyy · HH:mm:ss", { locale: de }) : "—"}
          </span>
          {isOffline && (
            <Badge variant="outline" className="ml-auto text-xs text-warning border-warning/50">
              <WifiOff className="h-3 w-3 mr-1" />Offline
            </Badge>
          )}
        </div>

        {!loading && (
          <div className="flex items-center gap-3 min-h-[28px]">
            {activeInfo ? (
              <>
                <span className={cn("w-2 h-2 rounded-full animate-pulse shrink-0", activeInfo.color)} />
                <Badge className={cn("text-sm", activeInfo.color)}>
                  {activeInfo.label}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  seit {format(new Date(activeEntry!.clockIn), "HH:mm")} Uhr
                </span>
                <span className="font-mono font-extralight ml-auto text-2xl tabular-nums tracking-wider">
                  {elapsedStr}
                </span>
              </>
            ) : (
              <Badge variant="secondary">Ausgestempelt</Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(STAMP_IN_TYPES) as [StampInType, (typeof STAMP_IN_TYPES)[StampInType]][]).map(
            ([key, info]) => (
              <Button
                key={key}
                size="sm"
                variant={activeEntry?.type === key ? "default" : "outline"}
                onClick={() => handleStamp(key)}
                disabled={!!acting}
                className={cn(
                  "text-xs h-9",
                  activeEntry?.type === key && info.color
                )}
              >
                {acting === key ? "..." : info.label}
              </Button>
            )
          )}
        </div>

        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedProject} onValueChange={(v) => setSelectedProject(v ?? "none")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Projekt (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Projekt</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: p.color ?? "#6b7280" }} />
                      <span className="font-mono text-xs">{p.code}</span>
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          variant="destructive"
          className="w-full h-10 text-sm font-semibold"
          onClick={() => handleStamp(STAMP_OUT_TYPE)}
          disabled={!activeEntry || !!acting}
        >
          {acting === STAMP_OUT_TYPE ? "..." : "Gehen"}
        </Button>
      </CardContent>
    </Card>
  );
}
