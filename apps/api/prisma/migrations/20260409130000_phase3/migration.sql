-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contractType" TEXT NOT NULL DEFAULT 'FULLTIME',
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "employeeNumber" TEXT,
ADD COLUMN     "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WorkingTimeConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8.0,
    "hoursPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "vacationDays" INTEGER NOT NULL DEFAULT 28,
    "breakMinutes" INTEGER NOT NULL DEFAULT 30,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkingTimeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkingTimeConfig_userId_key" ON "WorkingTimeConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeNumber_key" ON "User"("employeeNumber");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingTimeConfig" ADD CONSTRAINT "WorkingTimeConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
