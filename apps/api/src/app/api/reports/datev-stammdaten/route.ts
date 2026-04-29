import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";
import { format } from "date-fns";

/**
 * DATEV LODAS Personalstammdaten-Export
 * Format: Mandantennr;Beraternr;Personalnr;Name;Abteilung;Vertragsart;Eintrittsdatum;Sollstunden/Tag;Urlaubstage
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canExport = await hasPermission(session.user.id, "reports", "export");
  if (!canExport) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const datevSettings = await getSettings("datev");
  const mandantennr = datevSettings["datev.mandantennr"] ?? "";
  const beraternr = datevSettings["datev.beraternr"] ?? "";

  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      employeeNumber: true,
      name: true,
      email: true,
      contractType: true,
      startDate: true,
      dept: { select: { name: true } },
      workingTimeConfig: {
        select: { hoursPerDay: true, vacationDays: true },
      },
    },
    orderBy: { employeeNumber: "asc" },
  });

  const sep = ";";
  const header = [
    "Mandantennummer", "Beraternummer", "Personalnummer",
    "Name", "Email", "Abteilung", "Vertragsart",
    "Eintrittsdatum", "Sollstunden/Tag", "Urlaubstage/Jahr",
  ].join(sep);

  const rows = users
    .filter((u) => u.employeeNumber)
    .map((user) => {
      const eintrittsdatum = user.startDate
        ? format(new Date(user.startDate), "dd.MM.yyyy")
        : "";
      const hoursPerDay = user.workingTimeConfig?.hoursPerDay ?? 8;
      const vacationDays = user.workingTimeConfig?.vacationDays ?? 28;

      return [
        mandantennr, beraternr, user.employeeNumber,
        user.name, user.email, user.dept?.name ?? "",
        user.contractType, eintrittsdatum,
        hoursPerDay.toFixed(2), vacationDays.toString(),
      ].join(sep);
    });

  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datev-stammdaten.csv"`,
    },
  });
}
