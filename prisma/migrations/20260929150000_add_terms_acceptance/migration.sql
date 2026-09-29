-- Kullanım koşulları / KVKK aydınlatma onayının kaydı (users RLS'e tabi değil — şirket bazlı değil).
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "terms_version" TEXT;
