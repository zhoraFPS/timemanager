"use client";

import { useEffect, useState } from "react";
import { getDaysInMonth, getDay, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
}

interface Props {
  year: number;
  month: number;
  onDayClick?: (date: Date) => void;
  userId?: string;
  refreshKey?: number;
}

export function MonthCalendar({ year, month, onDayClick, userId, refreshKey }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (userId) params.set("userId", userId);
    fetch(`/api/time-entries/month?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []));
  }, [year, month, userId, refreshKey]);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const firstDay = (getDay(startOfMonth(new Date(year, month - 1))) + 6) % 7;
  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  function getHoursForDay(day: number) {
    return entries
      .filter((e) => new Date(e.clockIn).getDate() === day && e.clockOut)
      .reduce((sum, e) => {
        return sum + (new Date(e.clockOut!).getTime() - new Date(e.clockIn).getTime()) / 3600000;
      }, 0);
  }

  function getDayStyle(day: number) {
    const date = new Date(year, month - 1, day);
    const isWeekend = [0, 6].includes(getDay(date));
    if (isWeekend) return "bg-muted/20 text-muted-foreground opacity-50";
    const hours = getHoursForDay(day);
    if (hours >= 7.5) return "bg-success/20 text-success";
    if (hours > 0) return "bg-warning/20 text-warning";
    return "bg-destructive/20 text-destructive";
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-xs text-muted-foreground text-center py-1 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const hours = getHoursForDay(day);
          const dayDate = new Date(year, month - 1, day);
          const content = (
            <>
              <div className="font-medium">{day}</div>
              {hours > 0 && (
                <div className="text-xs mt-1 font-mono">
                  {Math.floor(hours)}:{String(Math.round((hours % 1) * 60)).padStart(2, "0")}h
                </div>
              )}
            </>
          );
          return onDayClick ? (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick(dayDate)}
              className={cn(
                "rounded-md p-2 min-h-[64px] text-sm text-left transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                getDayStyle(day)
              )}
            >
              {content}
            </button>
          ) : (
            <div key={day} className={cn("rounded-md p-2 min-h-[64px] text-sm", getDayStyle(day))}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
