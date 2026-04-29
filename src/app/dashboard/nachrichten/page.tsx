"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Bell, MessageSquare, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  sender: { name: string } | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  MESSAGE: MessageSquare,
  SYSTEM: Bell,
  APPROVAL: CheckCircle2,
  CORRECTION: CheckCircle2,
  REQUEST_APPROVED: CheckCircle2,
  REQUEST_REJECTED: Bell,
  NEW_REQUEST: Bell,
  FORGOT_CLOCKOUT: Bell,
  AUTO_CLOCKOUT: Bell,
};

export default function NachrichtenPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications ?? []);
        setLoading(false);
      });
  }, []);

  async function handleClick(n: Notification) {
    if (!n.isRead) {
      fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight">Nachrichten</h1>
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight">Nachrichten</h1>
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Keine Nachrichten vorhanden
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] ?? Bell;
            const clickable = !!n.link;
            return (
              <Card
                key={n.id}
                className={cn(
                  n.isRead && "opacity-70",
                  clickable && "transition-colors hover:border-primary/40"
                )}
              >
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
                  >
                    <NotificationBody n={n} Icon={Icon} clickable />
                  </button>
                ) : (
                  <NotificationBody n={n} Icon={Icon} clickable={false} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationBody({
  n,
  Icon,
  clickable,
}: {
  n: Notification;
  Icon: React.ElementType;
  clickable: boolean;
}) {
  return (
    <CardContent className="p-4 flex gap-3 items-start">
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{n.title}</p>
          {!n.isRead && <Badge className="text-xs bg-blue-600 text-white">Neu</Badge>}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {n.sender ? `Von: ${n.sender.name} · ` : ""}
          {format(new Date(n.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}
        </p>
      </div>
      {clickable && <ArrowRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
    </CardContent>
  );
}
