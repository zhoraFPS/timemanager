"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isWeekend,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayData {
  status: "present" | "absent" | null;
  minutes?: number;
  absenceType?: string;
}

interface CalendarUser {
  userId: string;
  name: string;
  department: string;
  days: Record<string, DayData>;
}

interface CalendarResponse {
  users: CalendarUser[];
  canSeeDetails: boolean;
  month: string;
}

// ---------------------------------------------------------------------------
// Absence type labels (only visible for manager/admin)
// ---------------------------------------------------------------------------

const ABSENCE_LABELS: Record<string, string> = {
  VACATION: "Urlaub",
  SICK: "Krank",
  SPECIAL_LEAVE: "Sonderurlaub",
  HOMEOFFICE: "Homeoffice",
  OVERTIME_REDUCE: "Gleittag",
  ABSENT: "Abwesend",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}h`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepartmentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const month = format(monthStart, "yyyy-MM");
    const res = await fetch(`/api/team/department-calendar?month=${month}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [monthStart.toISOString()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const users = data?.users ?? [];
  const canSeeDetails = data?.canSeeDetails ?? false;

  // Count present/absent for description
  const presentCount = new Set(
    users.filter((u) =>
      Object.values(u.days).some((d) => d.status === "present")
    ).map((u) => u.userId)
  ).size;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Teamkalender</CardTitle>
            <CardDescription>
              {format(currentDate, "MMMM yyyy", { locale: de })} — {users.length} Mitarbeiter
              {presentCount > 0 && `, ${presentCount} aktiv`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Heute
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-success/70" />
            <span className="text-xs text-muted-foreground">Anwesend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
            <span className="text-xs text-muted-foreground">Abwesend</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Skeleton className="h-64" />
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Keine Teammitglieder gefunden
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 px-2 font-medium text-muted-foreground sticky left-0 bg-card min-w-[140px] z-10">
                    Mitarbeiter
                  </th>
                  {days.map((day) => {
                    const weekend = isWeekend(day);
                    const today = isToday(day);
                    return (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "text-center py-1.5 px-0.5 font-medium min-w-[26px]",
                          weekend
                            ? "text-muted-foreground/40 bg-muted/30"
                            : "text-muted-foreground",
                          today && "text-primary font-bold"
                        )}
                      >
                        <div>{format(day, "EE", { locale: de }).charAt(0)}</div>
                        <div>{format(day, "d")}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.userId}
                    className="border-b border-border/30 hover:bg-muted/10"
                  >
                    <td className="py-1.5 px-2 sticky left-0 bg-card z-10">
                      <p className="font-medium truncate max-w-[130px]">
                        {user.name}
                      </p>
                      {user.department && (
                        <p className="text-muted-foreground truncate max-w-[130px] text-[10px]">
                          {user.department}
                        </p>
                      )}
                    </td>
                    {days.map((day) => {
                      const dayKey = format(day, "yyyy-MM-dd");
                      const dayData = user.days[dayKey];
                      const weekend = isWeekend(day);
                      const today = isToday(day);

                      if (weekend) {
                        return (
                          <td
                            key={dayKey}
                            className="text-center py-1.5 px-0.5 bg-muted/20"
                          />
                        );
                      }

                      if (!dayData || !dayData.status) {
                        return (
                          <td
                            key={dayKey}
                            className={cn(
                              "text-center py-1.5 px-0.5",
                              today && "bg-primary/5"
                            )}
                          />
                        );
                      }

                      const isPresent = dayData.status === "present";
                      const isAbsent = dayData.status === "absent";

                      // Tooltip content
                      let tooltip = `${user.name}: `;
                      if (isPresent) {
                        tooltip += "Anwesend";
                        if (canSeeDetails && dayData.minutes) {
                          tooltip += ` (${formatMinutes(dayData.minutes)})`;
                        }
                      } else if (isAbsent) {
                        tooltip +=
                          ABSENCE_LABELS[dayData.absenceType ?? "ABSENT"] ??
                          "Abwesend";
                      }

                      return (
                        <td
                          key={dayKey}
                          className={cn(
                            "text-center py-1.5 px-0.5",
                            today && "bg-primary/5"
                          )}
                        >
                          <div
                            className={cn(
                              "w-full h-5 rounded-sm transition-colors",
                              isPresent && "bg-success/60",
                              isAbsent && "bg-muted-foreground/25"
                            )}
                            title={tooltip}
                          />
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
