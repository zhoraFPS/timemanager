import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AuditLogClient } from "./audit-log-client";

export default async function AuditLogPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = checkPermission(session, "audit", "read", "all");
  if (!canRead) redirect("/dashboard");

  return <AuditLogClient />;
}
