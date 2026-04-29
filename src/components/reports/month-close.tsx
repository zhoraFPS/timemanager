"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Unlock, Check } from "lucide-react";

interface MonthCloseEntry {
  id: string;
  year: number;
  month: number;
  closedByName: string;
  closedAt: string;
  note: string | null;
}

const MONTH_NAMES = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function MonthCloseManager() {
  const [closes, setCloses] = useState<MonthCloseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCloses() {
    const res = await fetch("/api/admin/month-close");
    const data = await res.json();
    setCloses(data.closes ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchCloses(); }, []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Build last 6 months for quick actions
  const recentMonths: Array<{ year: number; month: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    recentMonths.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  function isClosed(year: number, month: number) {
    return closes.some((c) => c.year === year && c.month === month);
  }

  function getClose(year: number, month: number) {
    return closes.find((c) => c.year === year && c.month === month);
  }

  async function handleClose(year: number, month: number) {
    const res = await fetch("/api/admin/month-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    if (res.ok) await fetchCloses();
  }

  async function handleReopen(year: number, month: number) {
    const res = await fetch("/api/admin/month-close", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    if (res.ok) await fetchCloses();
  }

  if (loading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monatsabschluss</CardTitle>
        <CardDescription>
          Abgeschlossene Monate sind gegen Aenderungen gesperrt und koennen an die Lohnbuchhaltung exportiert werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentMonths.map(({ year, month }) => {
          const closed = isClosed(year, month);
          const closeEntry = getClose(year, month);
          const isCurrentMonth = year === currentYear && month === currentMonth;

          return (
            <div
              key={`${year}-${month}`}
              className="flex items-center justify-between p-3 border border-border rounded-md"
            >
              <div className="flex items-center gap-3">
                {closed ? (
                  <Lock className="h-4 w-4 text-success" />
                ) : (
                  <Unlock className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {MONTH_NAMES[month - 1]} {year}
                    {isCurrentMonth && (
                      <Badge variant="secondary" className="ml-2 text-xs">aktuell</Badge>
                    )}
                  </p>
                  {closed && closeEntry && (
                    <p className="text-xs text-muted-foreground">
                      Abgeschlossen von {closeEntry.closedByName} am{" "}
                      {new Date(closeEntry.closedAt).toLocaleDateString("de-DE")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {closed ? (
                  <>
                    <Badge className="bg-success/10 text-success">
                      <Check className="h-3 w-3 mr-1" />Abgeschlossen
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => handleReopen(year, month)}
                    >
                      Wieder oeffnen
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClose(year, month)}
                    disabled={isCurrentMonth}
                  >
                    <Lock className="h-3 w-3 mr-1" />
                    Abschliessen
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Der aktuelle Monat kann nicht abgeschlossen werden. Abgeschlossene Monate sperren
          Stempelvorgaenge, Zeitkorrekturen und Antraege fuer den jeweiligen Zeitraum.
        </p>
      </CardContent>
    </Card>
  );
}
