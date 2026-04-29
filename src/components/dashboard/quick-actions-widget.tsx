"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palmtree, Stethoscope, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

export function QuickActionsWidget() {
  const router = useRouter();
  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Schnellaktionen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
          onClick={() => router.push("/dashboard/antraege")}
        >
          <Palmtree className="h-4 w-4 text-primary" />
          Urlaub beantragen
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
          onClick={() => router.push("/dashboard/antraege")}
        >
          <Stethoscope className="h-4 w-4 text-destructive" />
          Krankmeldung
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm"
          onClick={() => router.push("/dashboard/zeitansicht")}
        >
          <Clock className="h-4 w-4 text-warning" />
          Zeitkorrektur
        </Button>
      </CardContent>
    </Card>
  );
}
