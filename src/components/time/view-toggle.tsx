"use client";

import { cn } from "@/lib/utils";
import { LayoutGrid, Columns, TableIcon } from "lucide-react";

export type ViewMode = "month" | "week" | "table";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  const options: { value: ViewMode; label: string; Icon: React.ElementType }[] = [
    { value: "month", label: "Monat", Icon: LayoutGrid },
    { value: "week", label: "Woche", Icon: Columns },
    { value: "table", label: "Tabelle", Icon: TableIcon },
  ];

  return (
    <div className="flex items-center border border-border rounded-md overflow-hidden">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
            mode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
