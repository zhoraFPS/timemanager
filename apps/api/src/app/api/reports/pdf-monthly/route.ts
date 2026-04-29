import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasPermission, getPermissionScope } from "@/lib/permissions";
import { calcNetMins } from "@/lib/working-time";
import { getHolidayDates, countWorkingDaysExcludingHolidays } from "@/lib/holidays";
import { loadSurchargeConfig, calcSurcharges, aggregateSurcharges } from "@/lib/surcharges";
import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, isWeekend } from "date-fns";
import { de } from "date-fns/locale";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canExport = await hasPermission(session.user.id, "reports", "export");

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId") ?? session.user.id;
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  // Permission check
  if (targetUserId !== session.user.id) {
    if (!canExport) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    const scope = await getPermissionScope(session.user.id, "reports", "export");
    if (scope === "own") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    if (scope === "team") {
      const isTeam = await db.user.findFirst({ where: { id: targetUserId, managerId: session.user.id } });
      if (!isTeam) return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }
  }

  const user = await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      name: true,
      employeeNumber: true,
      dept: { select: { name: true } },
      workingTimeConfig: { select: { hoursPerDay: true } },
      startDate: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  // Break config
  const breakConfigs = await db.systemConfig.findMany({
    where: { key: { in: ["workday.autoBreakEnabled", "workday.autoBreakAfterHours", "workday.autoBreakMinutes"] } },
  });
  const breakCfg = Object.fromEntries(breakConfigs.map((c) => [c.key, c.value]));
  const autoBreak = breakCfg["workday.autoBreakEnabled"] === "true";
  const breakAfterHours = parseFloat(breakCfg["workday.autoBreakAfterHours"] ?? "6");
  const breakMinutes = parseInt(breakCfg["workday.autoBreakMinutes"] ?? "30");

  // Branding
  const brandCfg = await db.systemConfig.findUnique({ where: { key: "branding.companyName" } });
  const companyName = brandCfg?.value ?? "VfL Bochum 1848";

  const hoursPerDay = user.workingTimeConfig?.hoursPerDay ?? 8;
  const holidays = await getHolidayDates(year);
  const surchargeCfg = await loadSurchargeConfig();

  const entries = await db.timeEntry.findMany({
    where: {
      userId: targetUserId,
      clockIn: { gte: monthStart, lte: monthEnd },
      clockOut: { not: null },
    },
    select: { clockIn: true, clockOut: true, type: true, note: true, project: { select: { code: true } } },
    orderBy: { clockIn: "asc" },
  });

  // Vacation/sick days
  const absences = await db.request.findMany({
    where: {
      userId: targetUserId,
      status: "APPROVED",
      type: { in: ["VACATION", "SICK", "SPECIAL_LEAVE"] },
      dateFrom: { lte: monthEnd },
      dateTo: { gte: monthStart },
    },
    select: { type: true, dateFrom: true, dateTo: true },
  });

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Build day rows
  const dayRows: string[][] = [];
  let totalActualMins = 0;
  let totalTargetMins = 0;
  const allSurcharges: ReturnType<typeof calcSurcharges>[] = [];

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayLabel = format(day, "EE dd.MM.", { locale: de });
    const weekend = isWeekend(day);
    const isHoliday = holidays.has(dateStr);

    // Check absence
    const absence = absences.find((a) => {
      const from = new Date(a.dateFrom);
      const to = new Date(a.dateTo);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return day >= from && day <= to;
    });

    if (weekend || isHoliday) {
      const label = isHoliday ? "Feiertag" : "Wochenende";
      dayRows.push([dayLabel, label, "", "", "", "", ""]);

      // Check if there are entries on weekends/holidays (surcharge-relevant)
      const dayEntries = entries.filter((e) => format(new Date(e.clockIn), "yyyy-MM-dd") === dateStr);
      if (dayEntries.length > 0) {
        for (const e of dayEntries) {
          const ci = new Date(e.clockIn);
          const co = new Date(e.clockOut!);
          const netMins = calcNetMins(ci, co, { autoBreak, breakAfterHours, breakMinutes });
          totalActualMins += netMins;
          allSurcharges.push(calcSurcharges(ci, co, surchargeCfg, holidays));
          dayRows[dayRows.length - 1] = [
            dayLabel, label,
            format(ci, "HH:mm"), format(co, "HH:mm"),
            fmtH(netMins), "0:00", e.type,
          ];
        }
      }
      continue;
    }

    if (absence) {
      const typeLabel = absence.type === "VACATION" ? "Urlaub" : absence.type === "SICK" ? "Krank" : "Sonderurlaub";
      dayRows.push([dayLabel, typeLabel, "", "", "", fmtH(hoursPerDay * 60), ""]);
      totalTargetMins += hoursPerDay * 60;
      continue;
    }

    // Normal working day
    const userStart = user.startDate ? new Date(user.startDate) : null;
    if (userStart && day < userStart) {
      dayRows.push([dayLabel, "", "", "", "", "", ""]);
      continue;
    }

    const targetDayMins = hoursPerDay * 60;
    totalTargetMins += targetDayMins;

    const dayEntries = entries.filter((e) => format(new Date(e.clockIn), "yyyy-MM-dd") === dateStr);

    if (dayEntries.length === 0) {
      dayRows.push([dayLabel, "", "", "", "0:00", fmtH(targetDayMins), ""]);
      continue;
    }

    let dayActual = 0;
    for (let i = 0; i < dayEntries.length; i++) {
      const e = dayEntries[i];
      const ci = new Date(e.clockIn);
      const co = new Date(e.clockOut!);
      const netMins = calcNetMins(ci, co, { autoBreak, breakAfterHours, breakMinutes });
      dayActual += netMins;
      allSurcharges.push(calcSurcharges(ci, co, surchargeCfg, holidays));

      const projCode = e.project?.code ?? "";
      if (i === 0) {
        dayRows.push([
          dayLabel, e.type,
          format(ci, "HH:mm"), format(co, "HH:mm"),
          "", fmtH(targetDayMins), projCode,
        ]);
      } else {
        dayRows.push(["", e.type, format(ci, "HH:mm"), format(co, "HH:mm"), "", "", projCode]);
      }
    }
    totalActualMins += dayActual;
    // Fill actual in first row of this day
    const firstRowIdx = dayRows.length - dayEntries.length;
    dayRows[firstRowIdx][4] = fmtH(dayActual);
  }

  const saldoMins = totalActualMins - totalTargetMins;
  const aggSurcharges = aggregateSurcharges(allSurcharges);

  // Generate PDF
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header
  doc.setFontSize(10);
  doc.text(companyName, 14, 15);
  doc.setFontSize(16);
  doc.text("Monatsnachweis Arbeitszeit", 14, 23);
  doc.setFontSize(10);
  doc.text(format(monthStart, "MMMM yyyy", { locale: de }), 14, 29);

  // Employee info
  doc.setFontSize(9);
  doc.text(`Mitarbeiter: ${user.name}`, 14, 37);
  doc.text(`Personalnr.: ${user.employeeNumber ?? "—"}`, 14, 42);
  doc.text(`Abteilung: ${user.dept?.name ?? "—"}`, 110, 37);
  doc.text(`Soll/Tag: ${hoursPerDay}h`, 110, 42);

  // Table
  autoTable(doc, {
    startY: 48,
    head: [["Tag", "Typ", "Von", "Bis", "Ist", "Soll", "Projekt"]],
    body: dayRows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 16 },
      3: { cellWidth: 16 },
      4: { cellWidth: 18 },
      5: { cellWidth: 18 },
      6: { cellWidth: 22 },
    },
  });

  // Summary below table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = ((doc as any).lastAutoTable?.finalY as number) ?? 250;
  let summaryY = finalY + 8;

  doc.setFontSize(9);
  doc.text("Zusammenfassung", 14, summaryY);
  summaryY += 6;
  doc.setFontSize(8);
  doc.text(`Soll gesamt: ${fmtH(totalTargetMins)}h`, 14, summaryY);
  doc.text(`Ist gesamt: ${fmtH(totalActualMins)}h`, 70, summaryY);
  doc.text(`Saldo: ${saldoMins >= 0 ? "+" : ""}${fmtH(saldoMins)}h`, 126, summaryY);

  if (aggSurcharges.nightMins > 0 || aggSurcharges.saturdayMins > 0 || aggSurcharges.sundayMins > 0 || aggSurcharges.holidayMins > 0) {
    summaryY += 6;
    doc.text("Zuschlaege:", 14, summaryY);
    summaryY += 4;
    if (aggSurcharges.nightMins > 0) { doc.text(`  Nacht (${aggSurcharges.nightPercent}%): ${fmtH(aggSurcharges.nightMins)}h`, 14, summaryY); summaryY += 4; }
    if (aggSurcharges.saturdayMins > 0) { doc.text(`  Samstag (${aggSurcharges.saturdayPercent}%): ${fmtH(aggSurcharges.saturdayMins)}h`, 14, summaryY); summaryY += 4; }
    if (aggSurcharges.sundayMins > 0) { doc.text(`  Sonntag (${aggSurcharges.sundayPercent}%): ${fmtH(aggSurcharges.sundayMins)}h`, 14, summaryY); summaryY += 4; }
    if (aggSurcharges.holidayMins > 0) { doc.text(`  Feiertag (${aggSurcharges.holidayPercent}%): ${fmtH(aggSurcharges.holidayMins)}h`, 14, summaryY); summaryY += 4; }
  }

  // Signature lines
  summaryY += 12;
  doc.setDrawColor(150);
  doc.line(14, summaryY, 80, summaryY);
  doc.line(110, summaryY, 180, summaryY);
  summaryY += 4;
  doc.setFontSize(7);
  doc.text("Mitarbeiter / Datum", 14, summaryY);
  doc.text("Vorgesetzter / Datum", 110, summaryY);

  // Footer
  doc.setFontSize(6);
  doc.text(
    `Erstellt am ${format(new Date(), "dd.MM.yyyy HH:mm")} — ${companyName}`,
    14, 290
  );

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `monatsnachweis-${user.employeeNumber ?? "x"}-${year}-${String(month).padStart(2, "0")}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function fmtH(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(mins);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}
