import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ZeitansichtClient } from "./zeitansicht-client";

export default async function ZeitansichtPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { userId } = await searchParams;

  if (!userId || userId === session.user.id) {
    return <ZeitansichtClient impersonatedUser={null} canAdminEdit={false} />;
  }

  const canViewAll = checkPermission(session, "time_entries", "read", "all");
  if (!canViewAll) redirect("/dashboard/zeitansicht");

  const canAdminEdit = checkPermission(session, "time_entries", "write", "all");

  const cookieHeader = (await cookies()).toString();
  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:3001"}/api/admin/users/${userId}`,
    { headers: { Cookie: cookieHeader }, cache: "no-store" }
  );
  if (!res.ok) redirect("/dashboard/zeitansicht");
  const { user: target } = await res.json();

  return (
    <ZeitansichtClient
      impersonatedUser={{
        id: target.id,
        name: target.name,
        employeeNumber: target.employeeNumber,
      }}
      canAdminEdit={canAdminEdit}
    />
  );
}
