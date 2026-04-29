"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardOverview } from "@/components/reports/dashboard-overview";
import { MonthlyReport } from "@/components/reports/monthly-report";
import { OvertimeReport } from "@/components/reports/overtime-report";
import { VacationReport } from "@/components/reports/vacation-report";
import { DatevExport } from "@/components/reports/datev-export";
import { FlextimeReport } from "@/components/reports/flextime-report";
import { MonthCloseManager } from "@/components/reports/month-close";
import { SurchargeReport } from "@/components/reports/surcharge-report";
import { ProjectReport } from "@/components/reports/project-report";
import { LayoutDashboard, BarChart3, Clock, CalendarDays, FileSpreadsheet, Timer, Lock, Moon, FolderKanban } from "lucide-react";

export function AuswertungenClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Auswertungen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monatsberichte, Ueberstunden-Analyse und Urlaubsuebersicht
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutDashboard className="h-4 w-4" />Dashboard
          </TabsTrigger>
          <TabsTrigger value="flextime" className="gap-1.5">
            <Timer className="h-4 w-4" />Gleitzeitkonto
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />Monatsreport
          </TabsTrigger>
          <TabsTrigger value="overtime" className="gap-1.5">
            <Clock className="h-4 w-4" />Ueberstunden
          </TabsTrigger>
          <TabsTrigger value="vacation" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />Urlaub
          </TabsTrigger>
          <TabsTrigger value="surcharges" className="gap-1.5">
            <Moon className="h-4 w-4" />Zuschlaege
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderKanban className="h-4 w-4" />Projekte
          </TabsTrigger>
          <TabsTrigger value="close" className="gap-1.5">
            <Lock className="h-4 w-4" />Abschluss
          </TabsTrigger>
          <TabsTrigger value="datev" className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />DATEV Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardOverview />
        </TabsContent>
        <TabsContent value="flextime">
          <FlextimeReport />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyReport />
        </TabsContent>
        <TabsContent value="overtime">
          <OvertimeReport />
        </TabsContent>
        <TabsContent value="vacation">
          <VacationReport />
        </TabsContent>
        <TabsContent value="surcharges">
          <SurchargeReport />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectReport />
        </TabsContent>
        <TabsContent value="close">
          <MonthCloseManager />
        </TabsContent>
        <TabsContent value="datev">
          <DatevExport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
