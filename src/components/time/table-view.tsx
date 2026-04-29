"use client";

import { useEffect, useState } from "react";
import { format, getDaysInMonth, getDay } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
}

interface BreakSettings {
  autoBreak: boolean;
  breakAfterHours: number;
  breakMinutes: number;
}

interface Props {
  year: number;
  month: number;
  targetHoursPerDay?: number;
  onEdit?: (entry: TimeEntry, day: Date) => void;
  onCreate?: (day: Date) => void;
  fetchUrl?: string;
}

function fmtMins(mins: number) {
  const sign = mins >= 0 ? "+" : "-";
  const abs = Math.abs(mins);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

function fmtDuration(mins: number) {
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

function calcNetMins(entry: TimeEntry, brk: BreakSettings): number {
  if (!entry.clockOut) return 0;
  const rawMins = Math.floor(
    (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 60000
  );
  if (brk.autoBreak && rawMins > brk.breakAfterHours * 60) {
    return Math.max(0, rawMins - brk.breakMinutes);
  }
  return rawMins;
}

export function TableView({
  year,
  month,
  targetHoursPerDay,
  onEdit,
  onCreate,
  fetchUrl,
}: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [hoursPerDay, setHoursPerDay] = useState(targetHoursPerDay ?? 8);
  const [breakSettings, setBreakSettings] = useState<BreakSettings>({
    autoBreak: false,
    breakAfterHours: 6,
    breakMinutes: 30,
  });

  useEffect(() => {
    const url = fetchUrl ?? `/api/time-entries/month?year=${year}&month=${month}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? d.timeEntries ?? []);
        if (d.workingTimeConfig?.hoursPerDay && !targetHoursPerDay) {
          setHoursPerDay(d.workingTimeConfig.hoursPerDay);
        }
        if (d.breakSettings) {
          setBreakSettings(d.breakSettings);
        }
      });
  }, [year, month, fetchUrl, targetHoursPerDay]);

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));

  function getEntriesForDay(day: number) {
    return entries.filter((e) => new Date(e.clockIn).getDate() === day);
  }

  let totalActualMins = 0;
  let totalSaldoMins = 0;

  const rows = Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
    const date = new Date(year, month - 1, day);
    const isWeekend = [0, 6].includes(getDay(date));
    const dayEntries = getEntriesForDay(day);
    const actualMins = dayEntries.reduce((s, e) => s + calcNetMins(e, breakSettings), 0);
    const targetMins = isWeekend ? 0 : hoursPerDay * 60;
    const saldoMins = actualMins - targetMins;
    if (!isWeekend) {
      totalActualMins += actualMins;
      totalSaldoMins += saldoMins;
    }
    return { day, date, isWeekend, dayEntries, actualMins, targetMins, saldoMins };
  });

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tag</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Typ</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Einstpl.</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Ausstpl.</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Ist</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Saldo</th>
            <th className="py-2 px-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.flatMap(({ day, date, isWeekend, dayEntries, actualMins, saldoMins }) => {
            const hasEntries = dayEntries.length > 0;
            const dayLabel = format(date, "EEE, dd.MM.", { locale: de });
            const rowCount = hasEntries ? dayEntries.length : 1;
            const saldoCell =
              !isWeekend ? (
                <span className={cn(saldoMins >= 0 ? "text-success" : "text-destructive", "font-semibold")}>
                  {fmtMins(saldoMins)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              );

            // Empty day — single placeholder row with Plus-Button (if allowed)
            if (!hasEntries) {
              return [
                <tr
                  key={`${day}-empty`}
                  className={cn(
                    "border-b border-border/40 hover:bg-muted/10 transition-colors",
                    isWeekend && "opacity-40",
                  )}
                >
                  <td className="py-2 px-3 font-medium whitespace-nowrap">{dayLabel}</td>
                  <td className="py-2 px-3 text-muted-foreground">—</td>
                  <td className="py-2 px-3 text-center font-mono text-xs text-muted-foreground">—</td>
                  <td className="py-2 px-3 text-center font-mono text-xs text-muted-foreground">—</td>
                  <td className="py-2 px-3 text-center font-mono text-xs">{fmtDuration(actualMins)}</td>
                  <td className="py-2 px-3 text-center font-mono text-xs">{saldoCell}</td>
                  <td className="py-2 px-3 text-right">
                    {!isWeekend && onCreate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-40 hover:opacity-100"
                        onClick={() => onCreate(date)}
                        title="Eintrag hinzufuegen"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>,
              ];
            }

            // One <tr> per stamp. Day label + day totals span all rows via rowSpan.
            return dayEntries.map((entry, i) => {
              const isFirst = i === 0;
              const info = STAMP_IN_TYPES[entry.type as keyof typeof STAMP_IN_TYPES];
              return (
                <tr
                  key={entry.id}
                  className={cn(
                    "hover:bg-muted/10 transition-colors",
                    isWeekend && "opacity-40",
                    isFirst && "border-t border-border/40",
                    // Last entry in day gets the border-bottom divider
                    i === dayEntries.length - 1 && "border-b border-border/40",
                  )}
                >
                  {isFirst && (
                    <td
                      rowSpan={rowCount}
                      className="py-2 px-3 font-medium whitespace-nowrap align-top"
                    >
                      {dayLabel}
                    </td>
                  )}
                  <td className="py-1.5 px-3">
                    <Badge className={cn("text-xs text-white", info?.color ?? "bg-muted")}>
                      {info?.label ?? entry.type}
                    </Badge>
                  </td>
                  <td className="py-1.5 px-3 text-center font-mono text-xs">
                    {format(new Date(entry.clockIn), "HH:mm")}
                  </td>
                  <td className="py-1.5 px-3 text-center font-mono text-xs">
                    {entry.clockOut ? format(new Date(entry.clockOut), "HH:mm") : "—"}
                  </td>
                  {isFirst && (
                    <td
                      rowSpan={rowCount}
                      className="py-2 px-3 text-center font-mono text-xs align-middle"
                    >
                      {fmtDuration(actualMins)}
                    </td>
                  )}
                  {isFirst && (
                    <td
                      rowSpan={rowCount}
                      className="py-2 px-3 text-center font-mono text-xs align-middle"
                    >
                      {saldoCell}
                    </td>
                  )}
                  <td className="py-1.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!isWeekend && onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onEdit(entry, date)}
                          title="Diesen Eintrag bearbeiten"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {!isWeekend && isFirst && onCreate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-40 hover:opacity-100"
                          onClick={() => onCreate(date)}
                          title="Weiteren Eintrag hinzufuegen"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold bg-muted/20">
            <td colSpan={4} className="py-2 px-3 text-muted-foreground text-sm">
              Gesamt
            </td>
            <td className="py-2 px-3 text-center font-mono text-sm">
              {fmtDuration(totalActualMins)}
            </td>
            <td
              className={cn(
                "py-2 px-3 text-center font-mono text-sm",
                totalSaldoMins >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {fmtMins(totalSaldoMins)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
