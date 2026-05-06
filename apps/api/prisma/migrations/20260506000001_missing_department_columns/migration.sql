-- AlterTable: add columns missing from Department
ALTER TABLE "Department"
  ADD COLUMN IF NOT EXISTS "kostenstelleNr" TEXT,
  ADD COLUMN IF NOT EXISTS "leaderId"        TEXT;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_leaderId_fkey"
  FOREIGN KEY ("leaderId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
