import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

type SeedPermission = { resource: string; action: string; scope: string };

/**
 * Keep a system role fully in sync: update name/description, then wipe and
 * recreate its permission rows. Non-system roles are never touched.
 */
async function syncSystemRole(opts: {
  name: string;
  description: string;
  permissions: SeedPermission[];
}) {
  const role = await db.role.upsert({
    where: { name: opts.name },
    update: { description: opts.description, isSystem: true },
    create: { name: opts.name, description: opts.description, isSystem: true },
  });
  await db.rolePermission.deleteMany({ where: { roleId: role.id } });
  await db.rolePermission.createMany({
    data: opts.permissions.map((p) => ({ ...p, roleId: role.id })),
  });
  return role;
}

async function main() {
  // Arbeitszeitmodell
  const defaultModel = await db.workingTimeModel.upsert({
    where: { name: "Standard 40h" },
    update: {},
    create: {
      name: "Standard 40h",
      hoursPerDay: 8.0,
      hoursPerWeek: 40.0,
      breakMinutes: 30,
      vacationDaysPerYear: 28,
    },
  });

  // SuperAdmin Rolle — absolute superpowers
  const superAdminRole = await syncSystemRole({
    name: "SUPERADMIN",
    description: "Vollzugriff auf alle Funktionen",
    permissions: [
      { resource: "time_entries", action: "read", scope: "all" },
      { resource: "time_entries", action: "write", scope: "all" },
      { resource: "time_entries", action: "export", scope: "all" },
      { resource: "requests", action: "read", scope: "all" },
      { resource: "requests", action: "write", scope: "all" },
      { resource: "requests", action: "approve", scope: "all" },
      { resource: "employees", action: "read", scope: "all" },
      { resource: "employees", action: "write", scope: "all" },
      { resource: "reports", action: "read", scope: "all" },
      { resource: "reports", action: "export", scope: "all" },
      { resource: "roles", action: "read", scope: "all" },
      { resource: "roles", action: "write", scope: "all" },
      { resource: "settings", action: "read", scope: "all" },
      { resource: "settings", action: "write", scope: "all" },
      { resource: "audit", action: "read", scope: "all" },
    ],
  });

  // HR Admin — everything except role management
  await syncSystemRole({
    name: "HR_ADMIN",
    description: "Personalverwaltung, DATEV, Einstellungen und Audit",
    permissions: [
      { resource: "time_entries", action: "read", scope: "all" },
      { resource: "time_entries", action: "write", scope: "all" },
      { resource: "time_entries", action: "export", scope: "all" },
      { resource: "requests", action: "read", scope: "all" },
      { resource: "requests", action: "approve", scope: "all" },
      { resource: "employees", action: "read", scope: "all" },
      { resource: "employees", action: "write", scope: "all" },
      { resource: "reports", action: "read", scope: "all" },
      { resource: "reports", action: "export", scope: "all" },
      { resource: "settings", action: "read", scope: "all" },
      { resource: "settings", action: "write", scope: "all" },
      { resource: "audit", action: "read", scope: "all" },
    ],
  });

  // Manager — team-level approvals only
  await syncSystemRole({
    name: "MANAGER",
    description: "Teamleitung — Anträge genehmigen",
    permissions: [
      { resource: "time_entries", action: "read", scope: "team" },
      { resource: "requests", action: "read", scope: "team" },
      { resource: "requests", action: "approve", scope: "team" },
      { resource: "reports", action: "read", scope: "team" },
    ],
  });

  // Employee — self-service only
  await syncSystemRole({
    name: "EMPLOYEE",
    description: "Mitarbeiter — Standardzugriff",
    permissions: [
      { resource: "time_entries", action: "read", scope: "own" },
      { resource: "time_entries", action: "write", scope: "own" },
      { resource: "requests", action: "read", scope: "own" },
      { resource: "requests", action: "write", scope: "own" },
    ],
  });

  // SuperAdmin User
  const passwordHash = await bcrypt.hash("admin123", 12);
  const adminUser = await db.user.upsert({
    where: { email: "admin@firma.de" },
    update: {},
    create: {
      email: "admin@firma.de",
      name: "System Admin",
      passwordHash,
      workingTimeModelId: defaultModel.id,
    },
  });

  await db.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: superAdminRole.id },
  });

  // SystemConfig
  const systemConfigs = [
    // Stamp-correction policy
    //  - within directCorrectionDays → employee edits directly, no approval
    //  - beyond that                 → submits request that HR_ADMIN handles
    //  - maxCorrectionDays = 0       → unlimited (month-close is the hard stop)
    { key: "stamp.directCorrectionDays", value: "3" },
    { key: "stamp.maxCorrectionDays", value: "0" },
    // Go-live date for flextime calc. Empty = use user.startDate only.
    { key: "workday.goLiveDate", value: "" },
    { key: "smtpHost", value: "" },
    { key: "smtpPort", value: "587" },
    { key: "smtpUser", value: "" },
    { key: "smtpFrom", value: "zeiterfassung@firma.de" },
  ];
  for (const cfg of systemConfigs) {
    await db.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }

  // Admin User updaten
  await db.user.update({
    where: { email: "admin@firma.de" },
    data: {
      mustChangePassword: false,
      employeeNumber: "1000",
      contractType: "FULLTIME",
    },
  });

  // Standard-Abteilungen
  const departments = [
    { name: "Geschaeftsfuehrung", kostenstelleNr: "1000" },
    { name: "Finanzen & Controlling", kostenstelleNr: "1100" },
    { name: "Personal & HR", kostenstelleNr: "1200" },
    { name: "Marketing & Kommunikation", kostenstelleNr: "1300" },
    { name: "Ticketing & Vertrieb", kostenstelleNr: "1400" },
    { name: "Stadionbetrieb", kostenstelleNr: "2000" },
    { name: "Spielbetrieb & Organisation", kostenstelleNr: "2100" },
    { name: "Nachwuchsleistungszentrum", kostenstelleNr: "2200" },
    { name: "Medizin & Athletik", kostenstelleNr: "2300" },
    { name: "IT & Digitales", kostenstelleNr: "3000" },
    { name: "Fanbetreuung & CSR", kostenstelleNr: "3100" },
    { name: "Recht & Compliance", kostenstelleNr: "3200" },
  ];
  for (const dept of departments) {
    await db.department.upsert({
      where: { name: dept.name },
      update: { kostenstelleNr: dept.kostenstelleNr },
      create: dept,
    });
  }

  // WorkingTimeConfig für Admin
  await db.workingTimeConfig.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      hoursPerDay: 8.0,
      hoursPerWeek: 40.0,
      vacationDays: 28,
      breakMinutes: 30,
    },
  });

  const newConfigs = [
    // Arbeitszeit — ArbZG-konform, Fussballverein Buero-Standard
    { key: "workday.maxHoursPerDay", value: "10" },
    { key: "workday.maxHoursPerWeek", value: "48" },
    { key: "workday.minRestHours", value: "11" },
    { key: "workday.autoBreakEnabled", value: "true" },
    { key: "workday.autoBreakAfterHours", value: "6" },
    { key: "workday.autoBreakMinutes", value: "30" },
    { key: "workday.extBreakAfterHours", value: "9" },
    { key: "workday.extBreakMinutes", value: "45" },
    { key: "workday.flexiStart", value: "06:00" },
    { key: "workday.flexiEnd", value: "22:00" },
    { key: "workday.coreStart", value: "09:00" },
    { key: "workday.coreEnd", value: "15:00" },
    { key: "workday.autoClockout", value: "true" },
    { key: "workday.autoClockoutTime", value: "22:00" },
    { key: "workday.forgotClockoutHours", value: "2" },
    // Urlaub — Standard 30 Tage Uebertrag bis Ende Maerz
    { key: "vacation.carryoverEnabled", value: "true" },
    { key: "vacation.carryoverMonth", value: "3" },
    { key: "vacation.carryoverDay", value: "31" },
    { key: "vacation.maxConsecutiveDays", value: "21" },
    { key: "vacation.minNoticeDays", value: "7" },
    { key: "vacation.sickNoteAfterDays", value: "3" },
    // Homeoffice — Fussballverein: begrenzt, Genehmigung noetig
    { key: "homeoffice.maxPerMonth", value: "8" },
    { key: "homeoffice.maxPerWeek", value: "2" },
    { key: "homeoffice.requireApproval", value: "true" },
    // Genehmigung — Manager genehmigt, Eskalation nach 5 Tagen
    { key: "approval.vacationApprover", value: "manager" },
    { key: "approval.correctionApprover", value: "hr" },
    { key: "approval.escalationDays", value: "5" },
    { key: "approval.multiStageAboveDays", value: "10" },
    // Stempel — Mobile erlaubt fuer Auswaertsspiele/Dienstreisen
    { key: "stamp.mobileAllowed", value: "true" },
    { key: "stamp.geofencingEnabled", value: "true" },
    { key: "stamp.geofencingRadius", value: "500" },
    { key: "stamp.geofencingLat", value: "51.4927" },
    { key: "stamp.geofencingLng", value: "7.4518" },
    { key: "stamp.ipWhitelistEnabled", value: "false" },
    { key: "stamp.ipWhitelist", value: "" },
    // Feiertage — NRW
    { key: "holidays.state", value: "NW" },
    { key: "holidays.customDays", value: JSON.stringify([
      { date: "2026-12-24", name: "Heiligabend (betriebsfrei)" },
      { date: "2026-12-31", name: "Silvester (betriebsfrei)" },
    ]) },
    // Benachrichtigungen — aktiv fuer HR
    { key: "notify.forgotClockout", value: "true" },
    { key: "notify.lowVacationDays", value: "5" },
    { key: "notify.overtimeAlertHours", value: "20" },
    { key: "notify.dailySummaryEnabled", value: "true" },
    { key: "notify.dailySummaryTime", value: "17:00" },
    // Sicherheit — Enterprise-Standard
    { key: "security.passwordMinLength", value: "10" },
    { key: "security.passwordRequireUpper", value: "true" },
    { key: "security.passwordRequireLower", value: "true" },
    { key: "security.passwordRequireNumber", value: "true" },
    { key: "security.passwordRequireSymbol", value: "true" },
    { key: "security.passwordHistorySize", value: "5" },
    { key: "security.passwordExpiryDays", value: "90" },
    { key: "security.maxLoginAttempts", value: "5" },
    { key: "security.sessionTimeoutMins", value: "480" },
    { key: "security.allowRememberMe", value: "true" },
    { key: "security.twoFactorEnforced", value: "false" },
    { key: "security.ssoEnabled", value: "false" },
    { key: "security.ssoProvider", value: "" },
    { key: "security.ssoClientId", value: "" },
    { key: "security.ssoIssuerUrl", value: "" },
    // Branding
    { key: "branding.companyName", value: "VfL Bochum 1848" },
    { key: "branding.primaryColor", value: "#1d4ed8" },
    { key: "branding.language", value: "de" },
    // Export — Lohnbuchhaltung am 25., DATEV-kompatibel
    { key: "export.payrollDay", value: "25" },
    { key: "export.csvSeparator", value: ";" },
    { key: "export.csvDateFormat", value: "dd.MM.yyyy" },
    { key: "export.autoExportEnabled", value: "true" },
    { key: "export.autoExportEmail", value: "lohnbuchhaltung@fc-beispielstadt.de" },
    // DATEV — LODAS-Integration
    { key: "datev.mandantennr", value: "12345" },
    { key: "datev.beraternr", value: "1001" },
    { key: "datev.wirtschaftsjahr", value: "2026" },
    { key: "datev.lodasVersion", value: "12.0" },
    // Lohnarten-Mapping: Stempelart → DATEV-Lohnart-Nummer
    { key: "datev.lohnart.WORK", value: "200" },
    { key: "datev.lohnart.MOBILE_WORK", value: "200" },
    { key: "datev.lohnart.HOME_GAME", value: "210" },
    { key: "datev.lohnart.AWAY_GAME", value: "215" },
    { key: "datev.lohnart.BUSINESS_TRIP", value: "220" },
    { key: "datev.lohnart.TRAINING", value: "230" },
    { key: "datev.lohnart.VOLUNTEERING", value: "240" },
    { key: "datev.lohnart.OVERTIME", value: "250" },
    { key: "datev.lohnart.NIGHT_SURCHARGE", value: "260" },
    { key: "datev.lohnart.SATURDAY_SURCHARGE", value: "261" },
    { key: "datev.lohnart.SUNDAY_SURCHARGE", value: "262" },
    { key: "datev.lohnart.HOLIDAY_SURCHARGE", value: "263" },
    // Fehlzeiten-Schluessel
    { key: "datev.absence.VACATION", value: "U" },
    { key: "datev.absence.SICK", value: "K" },
    { key: "datev.absence.SPECIAL_LEAVE", value: "SU" },
    // Zuschlaege — Fussball-typisch
    { key: "surcharge.nightEnabled", value: "true" },
    { key: "surcharge.nightStart", value: "20:00" },
    { key: "surcharge.nightEnd", value: "06:00" },
    { key: "surcharge.nightPercent", value: "25" },
    { key: "surcharge.weekendEnabled", value: "true" },
    { key: "surcharge.saturdayPercent", value: "25" },
    { key: "surcharge.sundayPercent", value: "50" },
    { key: "surcharge.holidayEnabled", value: "true" },
    { key: "surcharge.holidayPercent", value: "100" },
    // SMTP
    { key: "smtp.Host", value: "mail.fc-beispielstadt.de" },
    { key: "smtp.Port", value: "587" },
    { key: "smtp.User", value: "zeiterfassung@fc-beispielstadt.de" },
    { key: "smtp.From", value: "zeiterfassung@fc-beispielstadt.de" },
  ];

  for (const cfg of newConfigs) {
    await db.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }

  // Standard-Projekte
  const projects = [
    { name: "Heimspiel-Organisation", code: "HOME", color: "#3b82f6", description: "Spieltag-Organisation fuer Heimspiele" },
    { name: "Auswaertsspiel-Begleitung", code: "AWAY", color: "#ef4444", description: "Reise und Betreuung bei Auswaertsspielen" },
    { name: "Saisonvorbereitung", code: "PREP", color: "#10b981", description: "Vorbereitungsphase und Trainingslager" },
    { name: "Nachwuchsfoerderung", code: "YOUTH", color: "#8b5cf6", description: "NLZ-Betrieb und Jugendarbeit" },
    { name: "Fanbetreuung & Events", code: "FAN", color: "#f59e0b", description: "Fan-Events, Meet&Greet, CSR" },
    { name: "Stadion-Infrastruktur", code: "INFRA", color: "#6366f1", description: "Wartung, Umbau, Spieltagsaufbau" },
  ];
  for (const proj of projects) {
    await db.project.upsert({
      where: { code: proj.code },
      update: {},
      create: proj,
    });
  }

  // Standard-Schichtvorlagen
  const shiftTemplates = [
    { name: "Fruehschicht", startTime: "06:00", endTime: "14:00", color: "#f59e0b" },
    { name: "Normalschicht", startTime: "08:00", endTime: "16:30", color: "#3b82f6" },
    { name: "Spaetschicht", startTime: "14:00", endTime: "22:00", color: "#8b5cf6" },
    { name: "Spieltag", startTime: "10:00", endTime: "23:00", color: "#ef4444" },
    { name: "Halbtag", startTime: "08:00", endTime: "12:00", color: "#10b981" },
  ];
  for (const st of shiftTemplates) {
    await db.shiftTemplate.upsert({
      where: { name: st.name },
      update: {},
      create: st,
    });
  }

  console.log("✅ Seed erfolgreich. Admin: admin@firma.de / admin123");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
