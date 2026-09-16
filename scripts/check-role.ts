import { prisma } from "../src/lib/db/prisma";

async function main() {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  console.log(rows);
}
main().finally(() => prisma.$disconnect());
