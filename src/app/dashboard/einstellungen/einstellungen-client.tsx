"use client";

import { useState } from "react";
import { WorkdaySettings } from "@/components/settings/workday-settings";
import { SurchargeSettings } from "@/components/settings/surcharge-settings";
import { VacationSettings } from "@/components/settings/vacation-settings";
import { ApprovalSettings } from "@/components/settings/approval-settings";
import { StampSettings } from "@/components/settings/stamp-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { HolidaysSettings } from "@/components/settings/holidays-settings";
import { BrandingSettings } from "@/components/settings/branding-settings";
import { DepartmentManager } from "@/components/admin/department-manager";
import { ProjectManager } from "@/components/admin/project-manager";
import { ShiftTemplateManager } from "@/components/admin/shift-template-manager";
import { DatevSettings } from "@/components/settings/datev-settings";
import {
  Clock, CalendarDays, CheckSquare, Stamp, Bell, Shield, Palette,
  CalendarHeart, Building2, FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsGroup =
  | "workday" | "vacation" | "approval" | "stamp" | "notify"
  | "security" | "branding" | "holidays" | "organization" | "datev";

const GROUPS: {
  value: SettingsGroup;
  label: string;
  description: string;
  icon: typeof Clock;
}[] = [
  { value: "workday", label: "Arbeitszeit", description: "Maximale Stunden, Pausen, Zuschläge", icon: Clock },
  { value: "vacation", label: "Urlaub & HO", description: "Kontingente, Homeoffice-Regeln", icon: CalendarDays },
  { value: "approval", label: "Genehmigung", description: "Workflow und Vertretungen", icon: CheckSquare },
  { value: "stamp", label: "Stempel", description: "Korrekturfristen und Automatik", icon: Stamp },
  { value: "notify", label: "Benachrichtigungen", description: "E-Mail und Push-Konfiguration", icon: Bell },
  { value: "security", label: "Sicherheit", description: "SSO, 2FA, Session-Dauer", icon: Shield },
  { value: "branding", label: "Branding", description: "Name, Logo, Sprache", icon: Palette },
  { value: "holidays", label: "Feiertage", description: "Bundeslandspezifische Feiertage", icon: CalendarHeart },
  { value: "organization", label: "Organisation", description: "Abteilungen, Projekte, Schichten", icon: Building2 },
  { value: "datev", label: "DATEV", description: "LODAS, Lohn, eAU", icon: FileSpreadsheet },
];

export function EinstellungenClient() {
  const [active, setActive] = useState<SettingsGroup>("workday");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Systemweite Konfiguration für die gesamte Organisation
        </p>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-8 items-start">
        {/* Vertical sidebar */}
        <nav className="space-y-1 sticky top-0">
          {GROUPS.map((g) => {
            const Icon = g.icon;
            const isActive = active === g.value;
            return (
              <button
                key={g.value}
                onClick={() => setActive(g.value)}
                className={cn(
                  "w-full flex items-start gap-2.5 px-3 py-2 rounded-md text-left transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{g.label}</p>
                  <p className={cn("text-xs truncate", isActive ? "text-primary/80" : "text-muted-foreground")}>
                    {g.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="min-w-0 max-w-3xl space-y-6">
          {active === "workday" && (
            <>
              <WorkdaySettings />
              <section>
                <h2 className="text-lg font-semibold mb-1">Zuschläge</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Nacht-, Wochenend- und Feiertagszuschläge
                </p>
                <SurchargeSettings />
              </section>
            </>
          )}
          {active === "vacation" && <VacationSettings />}
          {active === "approval" && <ApprovalSettings />}
          {active === "stamp" && <StampSettings />}
          {active === "notify" && <NotificationSettings />}
          {active === "security" && <SecuritySettings />}
          {active === "branding" && <BrandingSettings />}
          {active === "holidays" && <HolidaysSettings />}
          {active === "organization" && (
            <>
              <DepartmentManager />
              <ProjectManager />
              <ShiftTemplateManager />
            </>
          )}
          {active === "datev" && <DatevSettings />}
        </div>
      </div>
    </div>
  );
}
