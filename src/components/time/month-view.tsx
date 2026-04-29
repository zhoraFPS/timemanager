"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  format,
  getDaysInMonth,
  getDay,
  differenceInMinutes,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
}

export function MonthView() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/time-entries/month?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setLoading(false);
      });
  }, [year, month]);

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));

  function getEntriesForDay(day: number) {
    return entries.filter((e) => new Date(e.clockIn).getDate() === day);
  }

  function calcHours(entry: TimeEntry): string | null {
    if (!entry.clockOut) return null;
    const mins = differenceInMinutes(
      new Date(entry.clockOut),
      new Date(entry.clockIn)
    );
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-medium w-48 text-center">
          {format(new Date(year, month - 1), "MMMM yyyy", { locale: de })}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Einträge...</p>
      ) : (
        <div className="space-y-1">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const date = new Date(year, month - 1, day);
            const dayEntries = getEntriesForDay(day);
            const isWeekend = [0, 6].includes(getDay(date));

            return (
              <Card
                key={day}
                className={isWeekend ? "opacity-40" : undefined}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm w-28 shrink-0">
                      {format(date, "EEE, dd.MM.", { locale: de })}
                    </span>
                    {dayEntries.length === 0 ? (
                      !isWeekend && (
                        <span className="text-sm text-muted-foreground">
                          Kein Eintrag
                        </span>
                      )
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {dayEntries.map((e) => (
                          <span key={e.id} className="text-sm font-mono">
                            {format(new Date(e.clockIn), "HH:mm")}
                            {e.clockOut &&
                              ` – ${format(new Date(e.clockOut), "HH:mm")}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {dayEntries.map((e) => {
                      const h = calcHours(e);
                      return h ? (
                        <Badge key={e.id} variant="outline" className="font-mono">
                          {h} h
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
