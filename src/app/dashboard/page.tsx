"use client";

import { useEffect, useState } from "react";
import { ClockWidget } from "@/components/dashboard/clock-widget";
import { TimeAccountWidget } from "@/components/dashboard/time-account-widget";
import { TeamStatusWidget } from "@/components/dashboard/team-status-widget";
import { QuickActionsWidget } from "@/components/dashboard/quick-actions-widget";
import { PendingRequestsWidget } from "@/components/dashboard/pending-requests-widget";
import { NotificationsWidget } from "@/components/dashboard/notifications-widget";

interface DashboardStats {
  timeAccount: {
    actualMins: number;
    targetMins: number;
    vacationLeft: number;
    vacationTotal: number;
  };
  team: { id: string; name: string; activeType: string | null }[];
  pendingRequests: { id: string; type: string; dateFrom: string; status: string }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => setStats(d));
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <ClockWidget />
        {stats && (
          <TimeAccountWidget
            actualMins={stats.timeAccount.actualMins}
            targetMins={stats.timeAccount.targetMins}
            vacationLeft={stats.timeAccount.vacationLeft}
            vacationTotal={stats.timeAccount.vacationTotal}
          />
        )}
        {stats && stats.team.length > 0 && (
          <TeamStatusWidget team={stats.team} />
        )}
        <QuickActionsWidget />
        {stats && (
          <PendingRequestsWidget requests={stats.pendingRequests} />
        )}
        <NotificationsWidget />
      </div>
    </div>
  );
}
