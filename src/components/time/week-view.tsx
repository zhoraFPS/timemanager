"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
}

interface Props {
  date: Date;
  onEntryClick?: (entry: TimeEntry) => void;
  userId?: string;
  refreshKey?: number;
}

const START_HOUR = 7;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR;

export function WeekView({ date, onEntryClick, userId, refreshKey }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const params = new URLSearchParams({ date: date.toISOString() });
    if (userId) params.set("userId", userId);
    fetch(`/api/time-entries/week?${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []));
  }, [date, userId, refreshKey]);

  function getEntriesForDay(day: Date) {
    return entries.filter(
      (e) => new Date(e.clockIn).toDateString() === day.toDateString()
    );
  }

  function toPercent(dt: Date) {
    const mins = dt.getHours() * 60 + dt.getMinutes();
    return Math.max(0, Math.min(100, ((mins - START_HOUR * 60) / (TOTAL_HOURS * 60)) * 100));
  }

  const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);
  const ROW_HEIGHT = 48;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[640px]"
        style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}
      >
        {/* Header */}
        <div className="border-b border-border pb-2" />
        {days.map((d) => (
          <div key={d.toISOString()} className="text-center pb-2 border-b border-border">
            <div className="text-sm font-medium">{format(d, "EEE", { locale: de })}</div>
            <div className="text-xs text-muted-foreground">{format(d, "dd.MM.")}</div>
          </div>
        ))}

        {/* Time labels */}
        <div className="relative" style={{ height: `${HOURS.length * ROW_HEIGHT}px` }}>
          {HOURS.map((h, i) => (
            <div
              key={h}
              className="absolute right-2 text-xs text-muted-foreground"
              style={{ top: `${i * ROW_HEIGHT}px` }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const dayEntries = getEntriesForDay(day);
          return (
            <div
              key={day.toISOString()}
              className="relative border-l border-border"
              style={{ height: `${HOURS.length * ROW_HEIGHT}px` }}
            >
              {HOURS.map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-t border-border/20"
                  style={{ top: `${i * ROW_HEIGHT}px` }}
                />
              ))}
              {dayEntries.map((entry) => {
                if (!entry.clockOut) return null;
                const top = toPercent(new Date(entry.clockIn));
                const bottom = toPercent(new Date(entry.clockOut));
                const height = Math.max(bottom - top, 2);
                const typeInfo = STAMP_IN_TYPES[entry.type as keyof typeof STAMP_IN_TYPES];
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onEntryClick?.(entry)}
                    className={cn(
                      "absolute left-0.5 right-0.5 rounded text-xs p-1 overflow-hidden text-white text-left transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                      typeInfo?.color ?? "bg-blue-600",
                      onEntryClick && "cursor-pointer"
                    )}
                    style={{ top: `${top}%`, height: `${height}%` }}
                    title={`${typeInfo?.label ?? entry.type}: ${format(new Date(entry.clockIn), "HH:mm")}–${format(new Date(entry.clockOut), "HH:mm")}`}
                  >
                    <span className="font-medium leading-tight block truncate">
                      {typeInfo?.label ?? entry.type}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
