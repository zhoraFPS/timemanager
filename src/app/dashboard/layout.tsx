import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { SessionProvider } from "@/components/layout/session-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.mustChangePassword) {
    redirect("/passwort-aendern");
  }

  const permissions = session.user.permissions ?? [];
  const roleNames = session.user.roleNames ?? [];

  return (
    <SessionProvider permissions={permissions} roleNames={roleNames}>
      <div className="flex h-screen bg-background">
        <Sidebar permissions={permissions} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header user={session.user} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto">
              <Breadcrumbs />
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
