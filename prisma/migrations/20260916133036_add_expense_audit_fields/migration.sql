-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "deleted_by" UUID,
ADD COLUMN     "updated_by" UUID;
