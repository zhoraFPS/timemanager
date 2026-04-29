"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Users, Plus, Pencil, Lock } from "lucide-react";
import { RoleEditSheet } from "@/components/admin/role-edit-sheet";
import { RESOURCE_LABELS, SCOPE_LABELS, type Resource, type Scope } from "@/lib/rbac";

interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  _count: { users: number };
}

export function RoleManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          className="gap-2"
          onClick={() => { setEditRole(null); setMode("create"); }}
        >
          <Plus className="h-4 w-4" /> Neue Rolle
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <Card key={role.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  {role.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {role.isSystem && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Lock className="h-3 w-3" /> System
                    </Badge>
                  )}
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    {role._count.users}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditRole(role); setMode("edit"); }}
                    title="Bearbeiten"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {role.description && (
                <p className="text-sm text-muted-foreground">{role.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {role.permissions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Berechtigungen</p>
                ) : (
                  role.permissions.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-xs">
                        {RESOURCE_LABELS[p.resource as Resource] ?? p.resource}
                      </Badge>
                      <span className="text-muted-foreground">{p.action}</span>
                      <Badge variant="secondary" className="text-xs">
                        {SCOPE_LABELS[p.scope as Scope] ?? p.scope}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RoleEditSheet
        role={editRole}
        mode={mode}
        onClose={() => { setMode(null); setEditRole(null); }}
        onSaved={load}
      />
    </div>
  );
}
