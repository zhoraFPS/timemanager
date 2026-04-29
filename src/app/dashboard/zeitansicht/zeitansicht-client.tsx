"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { addMonths, subMonths, addWeeks, subWeeks, format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X, UserCog } from "lucide-react";
import { ViewToggle, type ViewMode } from "@/components/time/view-toggle";
import { MonthCalendar } from "@/components/time/month-calendar";
import { WeekView } from "@/components/time/week-view";
import { TableView } from "@/components/time/table-view";
import { EditRequestModal } from "@/components/time/edit-request-modal";
import { HrEditModal } from "@/components/time/hr-edit-modal";
import { EmployeeBackfillModal } from "@/components/time/employee-backfill-modal";

interface Props {
  impersonatedUser: { id: string; name: string; employeeNumber: string | null } | null;
  canAdminEdit: boolean;
}

interface EntryToEdit {
  id: string;
  clockIn: string;
  clockOut: string | null;
  type: string;
}

export function ZeitansichtClient({ impersonatedUser, canAdminEdit }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<ViewMode>("table");
  const [date, setDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [employeeEdit, setEmployeeEdit] = useState<EntryToEdit | null>(null);
  const [employeeBackfillDate, setEmployeeBackfillDate] = useState<Date | null>(null);
  const [hrEdit, setHrEdit] = useState<EntryToEdit | null>(null);
  const [hrCreateDate, setHrCreateDate] = useState<Date | null>(null);

  const userId = impersonatedUser?.id;
  const isImpersonating = !!impersonatedUser;

  function prev() {
    setDate((d) => (mode === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  }
  function next() {
    setDate((d) => (mode === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  }

  function exitImpersonation() {
    const params = new URLSearchParams(searchParams);
    params.delete("userId");
    router.push(`/dashboard/zeitansicht${params.toString() ? `?${params}` : ""}`);
  }

  function handleEntryClick(entry: EntryToEdit) {
    if (isImpersonating && canAdminEdit) {
      setHrCreateDate(null);
      setHrEdit(entry);
    } else if (!isImpersonating) {
      setEmployeeEdit(entry);
    }
  }

  function handleCreate(day: Date) {
    if (isImpersonating && canAdminEdit) {
      setHrEdit(null);
      setHrCreateDate(day);
    } else if (!isImpersonating) {
      setEmployeeEdit(null);
      setEmployeeBackfillDate(day);
    }
  }

  const title =
    mode === "week"
      ? `KW ${format(date, "ww", { locale: de })} — ${format(date, "MMMM yyyy", { locale: de })}`
      : format(date, "MMMM yyyy", { locale: de });

  const monthFetchUrl = userId
    ? `/api/time-entries/month?year=${date.getFullYear()}&month=${date.getMonth() + 1}&userId=${userId}`
    : undefined;

  // Employees can backfill their own days; HR can both edit existing and
  // create new entries for the user they're viewing.
  const showCreate = isImpersonating ? canAdminEdit : true;

  return (
    <div className="space-y-4">
      {isImpersonating && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <UserCog className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                HR-Ansicht: Zeiten von <strong>{impersonatedUser.name}</strong>
                {impersonatedUser.employeeNumber && (
                  <span className="text-muted-foreground font-normal"> · Nr. {impersonatedUser.employeeNumber}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Änderungen werden direkt übernommen und im Audit-Log protokolliert.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exitImpersonation} className="gap-2">
              <X className="h-3.5 w-3.5" /> Zurück zu meiner Ansicht
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Zeitübersicht</h1>
        <ViewToggle mode={mode} onChange={setMode} />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-medium w-64 text-center">{title}</span>
        <Button variant="outline" size="icon" onClick={next}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {mode === "month" && (
        <MonthCalendar
          year={date.getFullYear()}
          month={date.getMonth() + 1}
          onDayClick={(d) => { setDate(d); setMode("week"); }}
          userId={userId}
          refreshKey={refreshKey}
        />
      )}
      {mode === "week" && (
        <WeekView
          date={date}
          onEntryClick={handleEntryClick}
          userId={userId}
          refreshKey={refreshKey}
        />
      )}
      {mode === "table" && (
        <TableView
          key={`${userId ?? "self"}-${refreshKey}`}
          year={date.getFullYear()}
          month={date.getMonth() + 1}
          onEdit={(entry) => handleEntryClick(entry)}
          onCreate={showCreate ? handleCreate : undefined}
          fetchUrl={monthFetchUrl}
        />
      )}

      {!isImpersonating && (
        <>
          <EditRequestModal
            open={!!employeeEdit}
            onClose={() => setEmployeeEdit(null)}
            onSuccess={() => setRefreshKey((k) => k + 1)}
            entry={employeeEdit}
          />
          <EmployeeBackfillModal
            open={!!employeeBackfillDate}
            onClose={() => setEmployeeBackfillDate(null)}
            onSuccess={() => setRefreshKey((k) => k + 1)}
            day={employeeBackfillDate}
          />
        </>
      )}

      {isImpersonating && canAdminEdit && (
        <HrEditModal
          open={!!hrEdit || !!hrCreateDate}
          onClose={() => { setHrEdit(null); setHrCreateDate(null); }}
          onSuccess={() => setRefreshKey((k) => k + 1)}
          entry={hrEdit}
          userId={userId}
          day={hrCreateDate}
        />
      )}
    </div>
  );
}
