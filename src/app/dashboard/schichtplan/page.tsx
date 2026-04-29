import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { SchichtplanClient } from "./schichtplan-client";

export default async function SchichtplanPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = checkPermission(session, "employees", "read", "all");
  if (!canRead) redirect("/dashboard");

  return <SchichtplanClient />;
}
