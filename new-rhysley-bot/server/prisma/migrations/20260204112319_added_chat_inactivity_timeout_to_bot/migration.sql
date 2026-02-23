/*
  Warnings:

  - You are about to drop the `GlobalSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "chatInactivityTimeout" INTEGER DEFAULT 300;

-- DropTable
DROP TABLE "GlobalSettings";
