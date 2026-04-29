"use client";
import { useEffect, useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserPlus, Pencil, CalendarClock, History } from "lucide-react";
import Link from "next/link";
import { CONTRACT_TYPES } from "@/lib/contract-types";
import { CreateEmployeeSheet } from "@/components/admin/create-employee-sheet";
import { EditEmployeeSheet } from "@/components/admin/edit-employee-sheet";

interface User {
  id: string; name: string; email: string | null; employeeNumber: string | null;
  contractType: string; isActive: boolean;
  dept: { name: string } | null;
  manager: { name: string } | null;
  roles: { role: { name: string } }[];
  workingTimeConfig: { hoursPerWeek: number; vacationDays: number } | null;
}

export function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [showCreate, setShowCreate] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (contractFilter) params.set("contractType", contractFilter);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/admin/users?${params}`)
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [search, contractFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, Nummer oder Abteilung..." className="pl-9" />
        </div>
        <Select value={contractFilter || "__all__"} onValueChange={(v) => setContractFilter(v === "__all__" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Vertragsart" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle</SelectItem>
            {Object.entries(CONTRACT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="inactive">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreate(true)} size="sm"><UserPlus className="h-4 w-4 mr-2" />Anlegen</Button>
      </div>

      {loading ? <Skeleton className="h-64 w-full" /> : users.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Keine Mitarbeiter gefunden</p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-20">Nr.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Vertrag</TableHead>
                <TableHead>h/W · Urlaub</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const contractInfo = CONTRACT_TYPES[user.contractType as keyof typeof CONTRACT_TYPES];
                return (
                  <TableRow key={user.id} className="hover:bg-muted/10">
                    <TableCell className="font-mono text-sm">{user.employeeNumber ?? "—"}</TableCell>
                    <TableCell><div><p className="font-medium text-sm">{user.name}</p>{user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}</div></TableCell>
                    <TableCell className="text-sm">{user.dept?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{contractInfo?.label ?? user.contractType}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.workingTimeConfig ? `${user.workingTimeConfig.hoursPerWeek}h · ${user.workingTimeConfig.vacationDays}T` : "—"}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{user.roles.map(r => <Badge key={r.role.name} variant="outline" className="text-xs">{r.role.name}</Badge>)}</div></TableCell>
                    <TableCell><Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">{user.isActive ? "Aktiv" : "Inaktiv"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5 justify-end">
                        <Link
                          href={`/dashboard/zeitansicht?userId=${user.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7")}
                          title="Zeitkalender anzeigen"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/dashboard/audit-log?employeeId=${user.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7")}
                          title="Audit-Log anzeigen"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditUserId(user.id)}
                          title="Bearbeiten"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EditEmployeeSheet
        userId={editUserId}
        onClose={() => setEditUserId(null)}
        onSaved={fetchUsers}
      />
      <CreateEmployeeSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={fetchUsers}
      />
    </div>
  );
}
