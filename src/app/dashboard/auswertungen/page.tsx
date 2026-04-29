import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AuswertungenClient } from "./auswertungen-client";

export default async function AuswertungenPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = checkPermission(session, "reports", "read");
  if (!canRead) redirect("/dashboard");

  return <AuswertungenClient />;
}
