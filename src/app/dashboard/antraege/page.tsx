"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { RequestForm } from "@/components/requests/request-form";
import { RequestList } from "@/components/requests/request-list";

interface OptimisticRequest {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export default function AntraegePage() {
  const searchParams = useSearchParams();
  const initialRequestId = searchParams.get("requestId");
  const [refreshKey, setRefreshKey] = useState(0);
  const [optimistic, setOptimistic] = useState<OptimisticRequest | null>(null);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight">Meine Anträge</h1>
      <RequestForm
        onSuccess={(created) => {
          if (created) setOptimistic(created);
          setRefreshKey((k) => k + 1);
        }}
      />
      <RequestList
        refreshKey={refreshKey}
        initialRequestId={initialRequestId}
        optimistic={optimistic}
      />
    </div>
  );
}
