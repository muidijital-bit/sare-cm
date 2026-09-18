// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";

async function main() {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  console.log(rows);
}
main().finally(() => prisma.$disconnect());