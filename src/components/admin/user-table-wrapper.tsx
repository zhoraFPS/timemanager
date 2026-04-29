"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserTable } from "@/components/admin/user-table";
import { CsvImport } from "@/components/admin/csv-import";

export function UserTableWrapper() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <Tabs defaultValue="list">
      <TabsList>
        <TabsTrigger value="list">Mitarbeiter</TabsTrigger>
        <TabsTrigger value="import">CSV-Import</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="mt-4">
        <UserTable key={refreshKey} />
      </TabsContent>
      <TabsContent value="import" className="mt-4 max-w-2xl">
        <CsvImport onSuccess={() => setRefreshKey(k => k + 1)} />
      </TabsContent>
    </Tabs>
  );
}
