import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { MitarbeiterTabs } from "./mitarbeiter-tabs";

export default async function MitarbeiterPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const canRead = checkPermission(session, "employees", "read", "all");
  if (!canRead) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Mitarbeiterverwaltung</h1>
      <MitarbeiterTabs />
    </div>
  );
}
