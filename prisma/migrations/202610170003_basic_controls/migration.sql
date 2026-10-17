ALTER TABLE "Survey" ADD COLUMN "startsAt" TIMESTAMP(3), ADD COLUMN "endsAt" TIMESTAMP(3), ADD COLUMN "maxResponses" INTEGER, ADD COLUMN "browserLimit" INTEGER, ADD COLUMN "ipLimit" INTEGER;
ALTER TABLE "Response" ADD COLUMN "isValid" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "browserHash" TEXT, ADD COLUMN "ipHash" TEXT;
CREATE INDEX "Response_surveyId_browserHash_idx" ON "Response"("surveyId", "browserHash");
CREATE INDEX "Response_surveyId_ipHash_idx" ON "Response"("surveyId", "ipHash");
CREATE INDEX "Response_surveyId_isValid_createdAt_idx" ON "Response"("surveyId", "isValid", "createdAt");
