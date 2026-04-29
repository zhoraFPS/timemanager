"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  actualMins: number;
  targetMins: number;
  vacationLeft: number;
  vacationTotal: number;
}

export function TimeAccountWidget({ actualMins, targetMins, vacationLeft, vacationTotal }: Props) {
  const saldoMins = actualMins - targetMins;
  const isPositive = saldoMins >= 0;
  const abs = Math.abs(saldoMins);
  const saldoStr = `${isPositive ? "+" : "-"}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}h`;
  const vacationPercent = vacationTotal > 0 ? Math.round((vacationLeft / vacationTotal) * 100) : 0;

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Mein Zeitkonto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm text-muted-foreground">Gleitzeitkonto</span>
          </div>
          <span className={cn("text-xl font-bold font-mono", isPositive ? "text-success" : "text-destructive")}>
            {saldoStr}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Palmtree className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Resturlaub</span>
            </div>
            <span className="font-medium">{vacationLeft} / {vacationTotal} Tage</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${vacationPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
