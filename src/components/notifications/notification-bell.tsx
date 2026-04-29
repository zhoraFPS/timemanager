"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  sender?: { name: string } | null;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      const data = await res.json();
      setCount(data.count ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?preview=true&limit=15");
      const data = await res.json();
      setItems(data.notifications ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
  }

  async function handleClick(n: Notification) {
    setOpen(false);
    if (!n.isRead) {
      await markRead(n.id);
      setCount((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev ? prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) : prev
      );
    }
    router.push(n.link ?? "/dashboard/nachrichten");
  }

  async function markAllRead() {
    if (!items?.length) return;
    await Promise.all(
      items.filter((n) => !n.isRead).map((n) => markRead(n.id))
    );
    setItems((prev) => (prev ? prev.map((x) => ({ ...x, isRead: true })) : prev));
    setCount(0);
  }

  const unread = (items ?? []).filter((n) => !n.isRead);
  const hasUnread = count > 0 || unread.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 max-h-[32rem] p-0 flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">Benachrichtigungen</p>
            {hasUnread && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {count} neu
              </Badge>
            )}
          </div>
          {hasUnread && items && items.length > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" />
              Alle gelesen
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && !items && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Lade...
            </div>
          )}
          {items && items.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Keine Benachrichtigungen
            </div>
          )}
          {items && items.length > 0 && (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted/60",
                      !n.isRead && "bg-primary/5"
                    )}
                  >
                    {!n.isRead && (
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    <div className={cn("flex-1 min-w-0", n.isRead && "pl-[0.875rem]")}>
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {n.body}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-2 py-1.5">
          <Link
            href="/dashboard/nachrichten"
            onClick={() => setOpen(false)}
            className="block text-center text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-md hover:bg-muted/60 transition-colors"
          >
            Alle Nachrichten anzeigen
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
