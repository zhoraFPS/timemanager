-- CreateTable: Project
CREATE TABLE IF NOT EXISTS "Project" (
    "id"          TEXT    NOT NULL,
    "name"        TEXT    NOT NULL,
    "code"        TEXT    NOT NULL,
    "description" TEXT,
    "color"       TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Project_name_key" ON "Project"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Project_code_key" ON "Project"("code");

-- AlterTable: TimeEntry — add projectId
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- AddForeignKey: TimeEntry → Project
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ShiftTemplate
CREATE TABLE IF NOT EXISTS "ShiftTemplate" (
    "id"        TEXT    NOT NULL,
    "name"      TEXT    NOT NULL,
    "startTime" TEXT    NOT NULL,
    "endTime"   TEXT    NOT NULL,
    "color"     TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShiftTemplate_name_key" ON "ShiftTemplate"("name");

-- CreateTable: Shift
CREATE TABLE IF NOT EXISTS "Shift" (
    "id"         TEXT    NOT NULL,
    "userId"     TEXT    NOT NULL,
    "templateId" TEXT    NOT NULL,
    "date"       DATE    NOT NULL,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Shift_userId_date_key" ON "Shift"("userId", "date");

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: Device
CREATE TABLE IF NOT EXISTS "Device" (
    "id"        TEXT    NOT NULL,
    "userId"    TEXT    NOT NULL,
    "deviceId"  TEXT    NOT NULL,
    "name"      TEXT,
    "pushToken" TEXT,
    "lastUsed"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Device_deviceId_key" ON "Device"("deviceId");

ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: DeviceToken
CREATE TABLE IF NOT EXISTS "DeviceToken" (
    "id"        TEXT    NOT NULL,
    "token"     TEXT    NOT NULL,
    "userId"    TEXT    NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_token_key" ON "DeviceToken"("token");

ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: MissingEntryRequest
CREATE TABLE IF NOT EXISTS "MissingEntryRequest" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "clockIn"     TIMESTAMP(3) NOT NULL,
    "clockOut"    TIMESTAMP(3),
    "type"        TEXT NOT NULL,
    "reason"      TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy"  TEXT,
    "reviewedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissingEntryRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MissingEntryRequest" ADD CONSTRAINT "MissingEntryRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: MonthClose
CREATE TABLE IF NOT EXISTS "MonthClose" (
    "id"       TEXT    NOT NULL,
    "year"     INTEGER NOT NULL,
    "month"    INTEGER NOT NULL,
    "closedBy" TEXT    NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"     TEXT,
    CONSTRAINT "MonthClose_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MonthClose_year_month_key" ON "MonthClose"("year", "month");
