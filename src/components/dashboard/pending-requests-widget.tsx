"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REQUEST_TYPES } from "@/lib/request-types";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface PendingRequest {
  id: string;
  type: string;
  dateFrom: string;
  status: string;
}

interface Props {
  requests: PendingRequest[];
}

export function PendingRequestsWidget({ requests }: Props) {
  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Offene Anträge
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Anträge</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => {
              const typeInfo = REQUEST_TYPES[r.type as keyof typeof REQUEST_TYPES];
              return (
                <div key={r.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{typeInfo?.label ?? r.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.dateFrom), "dd.MM.yyyy", { locale: de })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Ausstehend
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
