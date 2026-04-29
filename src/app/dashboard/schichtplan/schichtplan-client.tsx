"use client";

import { ShiftPlanner } from "@/components/shifts/shift-planner";

export function SchichtplanClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Schichtplanung</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Wochenweise Schichtplanung fuer Mitarbeiter
        </p>
      </div>
      <ShiftPlanner />
    </div>
  );
}
