"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isWeekend, addMonths, subMonths } from "date-fns";

interface Absence {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  user: { id: string; name: string; dept: { name: string } | null };
}

const TYPE_COLORS: Record<string, string> = {
  VACATION: "bg-primary",
  SICK: "bg-red-500",
  SPECIAL_LEAVE: "bg-purple-500",
  HOMEOFFICE: "bg-amber-500",
};

const TYPE_LABELS: Record<string, string> = {
  VACATION: "Urlaub",
  SICK: "Krank",
  SPECIAL_LEAVE: "Sonderurlaub",
  HOMEOFFICE: "Homeoffice",
};

export function AbsenceCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const fetchAbsences = useCallback(async () => {
    setLoading(true);
    const from = format(monthStart, "yyyy-MM-dd");
    const to = format(monthEnd, "yyyy-MM-dd");
    const res = await fetch(`/api/team/absences?from=${from}&to=${to}`);
    const data = await res.json();
    setAbsences(data.absences ?? []);
    setLoading(false);
  }, [monthStart.toISOString(), monthEnd.toISOString()]);

  useEffect(() => { fetchAbsences(); }, [fetchAbsences]);

  // Group absences by user
  const userMap = new Map<string, { name: string; dept: string; absences: Absence[] }>();
  for (const a of absences) {
    const existing = userMap.get(a.user.id);
    if (existing) {
      existing.absences.push(a);
    } else {
      userMap.set(a.user.id, { name: a.user.name, dept: a.user.dept?.name ?? "", absences: [a] });
    }
  }
  const users = Array.from(userMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));

  function getAbsenceForDay(userAbsences: Absence[], day: Date): Absence | null {
    const dayStr = format(day, "yyyy-MM-dd");
    return userAbsences.find((a) => {
      const from = format(new Date(a.dateFrom), "yyyy-MM-dd");
      const to = format(new Date(a.dateTo), "yyyy-MM-dd");
      return dayStr >= from && dayStr <= to;
    }) ?? null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Abwesenheitskalender</CardTitle>
            <CardDescription>
              {format(currentDate, "MMMM yyyy")} — {users.length} Mitarbeiter mit Abwesenheiten
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Heute
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Legend */}
        <div className="flex gap-3 mt-2">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${TYPE_COLORS[key]}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64" />
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Keine Abwesenheiten in diesem Monat
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground sticky left-0 bg-card min-w-[140px]">
                    Mitarbeiter
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={`text-center py-1.5 px-0.5 font-medium min-w-[24px] ${
                        isWeekend(day) ? "text-muted-foreground/40 bg-muted/30" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(([userId, { name, dept, absences: userAbsences }]) => (
                  <tr key={userId} className="border-b border-border/30 hover:bg-muted/10">
                    <td className="py-1 px-2 sticky left-0 bg-card">
                      <p className="font-medium truncate">{name}</p>
                      {dept && <p className="text-muted-foreground truncate">{dept}</p>}
                    </td>
                    {days.map((day) => {
                      const absence = getAbsenceForDay(userAbsences, day);
                      const weekend = isWeekend(day);
                      return (
                        <td
                          key={day.toISOString()}
                          className={`text-center py-1 px-0.5 ${weekend ? "bg-muted/30" : ""}`}
                        >
                          {absence && !weekend && (
                            <div
                              className={`w-full h-5 rounded-sm ${TYPE_COLORS[absence.type] ?? "bg-muted"}`}
                              title={`${name}: ${TYPE_LABELS[absence.type] ?? absence.type}`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
