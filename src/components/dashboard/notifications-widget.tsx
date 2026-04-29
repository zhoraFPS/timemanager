"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, MessageSquare, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  MESSAGE: MessageSquare,
  SYSTEM: Bell,
  APPROVAL: CheckCircle2,
  CORRECTION: CheckCircle2,
};

export function NotificationsWidget() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications?limit=5&preview=true")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Benachrichtigungen
          </CardTitle>
          <Link
            href="/dashboard/nachrichten"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Alle anzeigen
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Lade...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine neuen Benachrichtigungen</p>
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 5).map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell;
              const content = (
                <div className="flex gap-2 group cursor-pointer">
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm truncate group-hover:text-foreground transition-colors">
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <Badge className="text-[10px] px-1 py-0 bg-primary text-primary-foreground">Neu</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { locale: de, addSuffix: true })}
                    </p>
                  </div>
                </div>
              );

              return n.link ? (
                <Link key={n.id} href={n.link}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
