"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableView } from "@/components/time/table-view";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addMonths, subMonths, format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { REQUEST_TYPES, STATUS_LABELS } from "@/lib/request-types";

interface Props {
  userId: string;
}

interface Request {
  id: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  status: string;
}

export function MemberDetailView({ userId }: Props) {
  const [date, setDate] = useState(new Date());
  const [requests, setRequests] = useState<Request[]>([]);

  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  useEffect(() => {
    fetch(`/api/team/members/${userId}/stats?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => setRequests(d.requests ?? []));
  }, [userId, year, month]);

  return (
    <Tabs defaultValue="time">
      <TabsList>
        <TabsTrigger value="time">Zeitübersicht</TabsTrigger>
        <TabsTrigger value="requests">Anträge</TabsTrigger>
      </TabsList>

      <TabsContent value="time" className="space-y-4 mt-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setDate((d) => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium w-44 text-center">
            {format(date, "MMMM yyyy", { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setDate((d) => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <TableView
          year={year}
          month={month}
          fetchUrl={`/api/team/members/${userId}/stats?year=${year}&month=${month}`}
        />
      </TabsContent>

      <TabsContent value="requests" className="mt-4">
        <div className="space-y-2">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                Keine Anträge in diesem Jahr
              </CardContent>
            </Card>
          ) : (
            requests.map((r) => {
              const typeInfo = REQUEST_TYPES[r.type as keyof typeof REQUEST_TYPES];
              const statusInfo = STATUS_LABELS[r.status as keyof typeof STATUS_LABELS];
              return (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{typeInfo?.label ?? r.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.dateFrom), "dd.MM.yyyy", { locale: de })}
                        {" – "}
                        {format(new Date(r.dateTo), "dd.MM.yyyy", { locale: de })}
                      </p>
                    </div>
                    <Badge variant={statusInfo?.variant ?? "secondary"}>
                      {statusInfo?.label ?? r.status}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
