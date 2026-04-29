import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { EinstellungenClient } from "./einstellungen-client";

export default async function EinstellungenPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = checkPermission(session, "settings", "read", "all");
  if (!canRead) redirect("/dashboard");

  return <EinstellungenClient />;
}
