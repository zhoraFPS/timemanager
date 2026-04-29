"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { STAMP_IN_TYPES } from "@/lib/stamp-types";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  activeType: string | null;
}

interface Props {
  team: TeamMember[];
}

export function TeamStatusWidget({ team }: Props) {
  if (team.length === 0) return null;

  const presentCount = team.filter((m) => m.activeType !== null).length;
  const absentCount = team.length - presentCount;

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Abteilung heute
          </CardTitle>
          <div className="flex items-center gap-2">
            {presentCount > 0 && (
              <Badge variant="outline" className="text-xs text-success border-success/40">
                {presentCount} anwesend
              </Badge>
            )}
            {absentCount > 0 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {absentCount} abwesend
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[180px] overflow-y-auto">
          {team.map((m) => {
            const isPresent = m.activeType !== null;
            const typeInfo = m.activeType
              ? STAMP_IN_TYPES[m.activeType as keyof typeof STAMP_IN_TYPES]
              : null;
            const initials = m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

            return (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{m.name}</span>
                </div>
                {isPresent ? (
                  typeInfo ? (
                    <Badge className={cn("text-xs text-white", typeInfo.color)}>
                      {typeInfo.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-success border-success/40">
                      Anwesend
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Abwesend
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
