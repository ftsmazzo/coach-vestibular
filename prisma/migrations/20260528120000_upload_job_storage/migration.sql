-- AlterTable
ALTER TABLE "UploadJob" ADD COLUMN "storagePath" TEXT;

-- CreateIndex
CREATE INDEX "UploadJob_status_createdAt_idx" ON "UploadJob"("status", "createdAt");

-- AddForeignKey (UploadJob.userId -> User.id)
ALTER TABLE "UploadJob" ADD CONSTRAINT "UploadJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
