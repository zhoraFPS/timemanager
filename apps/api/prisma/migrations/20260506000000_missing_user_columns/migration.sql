-- AlterTable: add columns missing from previous migrations
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "twoFactorSecret"  TEXT,
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deputyId"         TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_deputyId_fkey"
  FOREIGN KEY ("deputyId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
