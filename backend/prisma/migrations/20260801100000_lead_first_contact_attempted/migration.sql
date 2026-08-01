-- AlterTable: first outbound contact clock (form-submit -> call-placed).
ALTER TABLE "leads" ADD COLUMN "first_contact_attempted_at" TIMESTAMP(3);
