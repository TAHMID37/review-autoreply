-- CreateEnum
CREATE TYPE "CommentCondition" AS ENUM ('PRESENT', 'ABSENT', 'ANY');

-- CreateTable
CREATE TABLE "response_templates" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_reply_rules" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'GOOGLE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "ratings" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "comment" "CommentCondition" NOT NULL DEFAULT 'ANY',
    "delayHours" INTEGER NOT NULL DEFAULT 24,
    "templateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_reply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "response_templates_brandId_idx" ON "response_templates"("brandId");

-- CreateIndex
CREATE INDEX "auto_reply_rules_brandId_idx" ON "auto_reply_rules"("brandId");

-- AddForeignKey
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
