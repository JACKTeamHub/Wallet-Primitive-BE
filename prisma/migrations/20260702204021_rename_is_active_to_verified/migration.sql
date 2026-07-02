/*
  Warnings:

  - You are about to drop the column `isActive` on the `developer_users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "developer_users" DROP COLUMN "isActive",
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;
