"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Settings2, ClipboardCheck } from "lucide-react";
import { EmployeeOverview } from "@/components/admin/employee-overview";
import { UserTableWrapper } from "@/components/admin/user-table-wrapper";
import { CorrectionRequests } from "@/components/admin/correction-requests";
import { MissingEntryRequests } from "@/components/admin/missing-entry-requests";

export function MitarbeiterTabs() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const correctionId = searchParams.get("correctionId");
  const missingId = searchParams.get("missingId");

  const initial =
    tabParam === "overview" || tabParam === "manage" || tabParam === "corrections"
      ? tabParam
      : correctionId || missingId
        ? "corrections"
        : "overview";
  const [tab, setTab] = useState<string>(initial);

  useEffect(() => {
    if (correctionId || missingId) setTab("corrections");
  }, [correctionId, missingId]);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="overview" className="gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Übersicht
        </TabsTrigger>
        <TabsTrigger value="manage" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          Verwaltung
        </TabsTrigger>
        <TabsTrigger value="corrections" className="gap-1.5">
          <ClipboardCheck className="h-4 w-4" />
          Zeitkorrekturen
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <EmployeeOverview />
      </TabsContent>

      <TabsContent value="manage" className="mt-4">
        <UserTableWrapper />
      </TabsContent>

      <TabsContent value="corrections" className="mt-4 space-y-8">
        <CorrectionRequests highlightId={correctionId} />
        <MissingEntryRequests highlightId={missingId} />
      </TabsContent>
    </Tabs>
  );
}
