"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePermissions } from "@/components/layout/session-context";
import { ApprovalList } from "@/components/team/approval-list";
import { DepartmentCalendar } from "@/components/team/department-calendar";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ChevronRight, CalendarDays, Inbox, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Member {
  id: string;
  name: string;
  email: string;
  department: string | null;
}

export default function TeamPage() {
  const searchParams = useSearchParams();
  const { permissions } = usePermissions();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const canApprove = permissions.some((p) => p.startsWith("requests:approve"));
  const canSeeMembers = permissions.some(
    (p) => p.startsWith("employees:read:all") || p.startsWith("employees:read:team")
  );

  const requestIdParam = searchParams.get("requestId");
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "approvals" || tabParam === "calendar" || tabParam === "members"
      ? tabParam
      : requestIdParam && canApprove
        ? "approvals"
        : canApprove
          ? "approvals"
          : "calendar";
  const [tab, setTab] = useState<string>(initialTab);

  useEffect(() => {
    if (requestIdParam && canApprove) setTab("approvals");
  }, [requestIdParam, canApprove]);

  useEffect(() => {
    if (!canSeeMembers) { setLoading(false); return; }
    fetch("/api/team/members")
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [canSeeMembers]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canApprove && (
            <TabsTrigger value="approvals" className="gap-1.5">
              <Inbox className="h-4 w-4" />Offene Anträge
            </TabsTrigger>
          )}
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />Kalender
          </TabsTrigger>
          {canSeeMembers && (
            <TabsTrigger value="members" className="gap-1.5">
              <UsersIcon className="h-4 w-4" />Mitarbeiter
            </TabsTrigger>
          )}
        </TabsList>

        {canApprove && (
          <TabsContent value="approvals" className="mt-4">
            <ApprovalList highlightRequestId={requestIdParam} />
          </TabsContent>
        )}

        <TabsContent value="calendar" className="mt-4">
          <DepartmentCalendar />
        </TabsContent>

        {canSeeMembers && (
          <TabsContent value="members" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : members.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Keine Mitarbeiter gefunden
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {members.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{m.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {m.email}
                          {m.department ? ` · ${m.department}` : ""}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/team/${m.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Details <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
