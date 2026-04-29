"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { DarkModeToggle } from "@/components/layout/dark-mode-toggle";

interface HeaderProps {
  user: { name: string; email: string };
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 flex items-center justify-end px-6 gap-3">
      <DarkModeToggle />
      <NotificationBell />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-[13px] text-foreground">{user.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {user.email}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push("/dashboard/profil")}>
              <User className="mr-2 h-4 w-4" />
              Mein Profil
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
