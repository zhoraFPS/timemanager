import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { RoleManager } from "@/components/admin/role-manager";

export default async function RollenPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = checkPermission(session, "roles", "read");
  if (!canRead) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Rollenverwaltung</h1>
      <RoleManager />
    </div>
  );
}
