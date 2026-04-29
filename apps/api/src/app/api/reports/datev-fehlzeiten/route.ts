import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, format } from "date-fns";

/**
 * DATEV LODAS Fehlzeiten-Export
 * Format: Mandantennr;Beraternr;Personalnr;Schluessel;Von;Bis;Tage
 * Exports approved VACATION, SICK, SPECIAL_LEAVE requests mapped to DATEV absence keys.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canExport = await hasPermission(session.user.id, "reports", "export");
  if (!canExport) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const datevSettings = await getSettings("datev");
  const mandantennr = datevSettings["datev.mandantennr"] ?? "";
  const beraternr = datevSettings["datev.beraternr"] ?? "";

  const absenceTypes = ["VACATION", "SICK", "SPECIAL_LEAVE"];

  const requests = await db.request.findMany({
    where: {
      type: { in: absenceTypes },
      status: "APPROVED",
      OR: [
        { dateFrom: { gte: monthStart, lte: monthEnd } },
        { dateTo: { gte: monthStart, lte: monthEnd } },
        { dateFrom: { lte: monthStart }, dateTo: { gte: monthEnd } },
      ],
    },
    select: {
      type: true,
      dateFrom: true,
      dateTo: true,
      user: {
        select: { employeeNumber: true, name: true },
      },
    },
    orderBy: [{ user: { employeeNumber: "asc" } }, { dateFrom: "asc" }],
  });

  const sep = ";";
  const header = [
    "Mandantennummer", "Beraternummer", "Personalnummer",
    "Fehlzeitenschluessel", "Von", "Bis", "Tage",
  ].join(sep);

  const rows: string[] = [];

  for (const r of requests) {
    if (!r.user.employeeNumber) continue;

    const schluesselKey = `datev.absence.${r.type}`;
    const schluessel = datevSettings[schluesselKey] ?? "";
    if (!schluessel) continue;

    // Clamp dates to the requested month
    const von = r.dateFrom < monthStart ? monthStart : new Date(r.dateFrom);
    const bis = r.dateTo > monthEnd ? monthEnd : new Date(r.dateTo);

    // Count working days in range
    let tage = 0;
    const d = new Date(von);
    d.setHours(0, 0, 0, 0);
    const endD = new Date(bis);
    endD.setHours(23, 59, 59, 999);
    while (d <= endD) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) tage++;
      d.setDate(d.getDate() + 1);
    }

    rows.push([
      mandantennr, beraternr, r.user.employeeNumber,
      schluessel,
      format(von, "dd.MM.yyyy"),
      format(bis, "dd.MM.yyyy"),
      tage.toString(),
    ].join(sep));
  }

  const monthLabel = format(monthStart, "yyyy-MM");
  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datev-fehlzeiten-${monthLabel}.csv"`,
    },
  });
}
