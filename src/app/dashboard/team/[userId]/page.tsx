import { auth } from "@/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MemberDetailView } from "@/components/team/member-detail-view";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const canRead = checkPermission(session, "time_entries", "read", "team");
  if (!canRead) redirect("/dashboard");

  const { userId } = await params;
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:3001"}/api/admin/users/${userId}`,
    { headers: { Cookie: cookieHeader }, cache: "no-store" }
  );
  if (!res.ok) redirect("/dashboard/team");
  const { user: member } = await res.json();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{member.name}</h1>
        <p className="text-muted-foreground text-sm">
          {member.email}
          {member.department ? ` · ${member.department}` : ""}
        </p>
      </div>
      <MemberDetailView userId={userId} />
    </div>
  );
}
