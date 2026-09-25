// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Bilinen şifreli demo/test hesaplarını devre dışı bırakır (silmez: isActive=false → giriş engellenir).
 *
 *   npx tsx scripts/disable-demo-accounts.ts            # KURU ÇALIŞMA: yalnızca ne yapacağını gösterir
 *   npx tsx scripts/disable-demo-accounts.ts --apply    # gerçekten uygular
 *
 * Canlıya çıkmadan önce canlı veritabanında çalıştırın (önce kuru çalışma!). Yerelde (dev dalı) demo
 * hesaplarla test etmeye devam edecekseniz --apply ÇALIŞTIRMAYIN.
 */
import { prisma } from "../src/lib/db/prisma";

const DEMO_EMAILS = ["admin@platform.test", "sare@demo.test"];

async function main() {
  const apply = process.argv.includes("--apply");
  const host = new URL(process.env.APP_DATABASE_URL!).hostname.split(".")[0];
  console.log(`Veritabanı sunucusu: ${host} — mod: ${apply ? "UYGULA" : "kuru çalışma (değişiklik yok)"}\n`);
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { in: DEMO_EMAILS } }, { email: { endsWith: "@demo.test" } }, { email: { endsWith: "@platform.test" } }] },
    select: { id: true, email: true, isActive: true, isSuperAdmin: true },
  });
  if (users.length === 0) console.log("Demo/test hesabı bulunamadı.");
  for (const u of users) {
    console.log(`${u.isActive ? "AKTİF " : "pasif "} ${u.isSuperAdmin ? "[süper admin] " : ""}${u.email}`);
    if (apply && u.isActive) await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
  }
  console.log(apply ? "\n✅ Aktif olanlar devre dışı bırakıldı." : "\n(Uygulamak için --apply ekleyin.)");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e.message); process.exit(1); });
