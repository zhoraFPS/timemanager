"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Clock,
  CalendarDays,
  FileText,
  Users,
  Shield,
  BarChart3,
  Settings,
  MessageSquare,
  UserCircle,
  ScrollText,
  CalendarClock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Nav items with required permission to see them
// null = visible to everyone
// ---------------------------------------------------------------------------

const navItems = [
  { href: "/dashboard", icon: Clock, label: "Dashboard", requires: null },
  { href: "/dashboard/zeitansicht", icon: CalendarDays, label: "Zeitübersicht", requires: null },
  { href: "/dashboard/antraege", icon: FileText, label: "Anträge", requires: null },
  { href: "/dashboard/nachrichten", icon: MessageSquare, label: "Nachrichten", requires: null },
  { href: "/dashboard/team", icon: Users, label: "Team", requires: null },
  { href: "/dashboard/schichtplan", icon: CalendarClock, label: "Schichtplan", requires: "employees:read:all" },
  { href: "/dashboard/auswertungen", icon: BarChart3, label: "Auswertungen", requires: "reports:read" },
  { href: "/dashboard/mitarbeiter", icon: Users, label: "Mitarbeiter", requires: "employees:read:all" },
  { href: "/dashboard/rollen", icon: Shield, label: "Rollen", requires: "roles:read" },
  { href: "/dashboard/audit-log", icon: ScrollText, label: "Audit-Log", requires: "audit:read" },
  { href: "/dashboard/einstellungen", icon: Settings, label: "Einstellungen", requires: "settings:read" },
  { href: "/dashboard/profil", icon: UserCircle, label: "Mein Profil", requires: null },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SidebarProps {
  permissions: string[];
}

function hasPermission(permissions: string[], required: string): boolean {
  // required format: "resource:action" or "resource:action:scope"
  // permissions format: "resource:action:scope"
  // "all" scope grants access to any required scope
  return permissions.some((p) => {
    if (p === required) return true;
    // If required has no scope, match any scope
    const reqParts = required.split(":");
    const permParts = p.split(":");
    if (reqParts.length === 2) {
      return permParts[0] === reqParts[0] && permParts[1] === reqParts[1];
    }
    // "all" scope matches everything
    if (permParts[0] === reqParts[0] && permParts[1] === reqParts[1] && permParts[2] === "all") {
      return true;
    }
    return false;
  });
}

export function Sidebar({ permissions }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.requires || hasPermission(permissions, item.requires)
  );

  return (
    <aside className="w-60 border-r border-border bg-sidebar flex flex-col">
      <div className="px-6 pt-6 pb-10">
        <span className="text-xl font-semibold tracking-tight text-sidebar-foreground">
          VfL Zeitspiel
        </span>
      </div>
      <nav className="flex-1 p-2.5 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary dark:bg-primary/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
