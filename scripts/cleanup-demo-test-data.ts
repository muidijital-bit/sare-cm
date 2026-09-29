// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Demo şirketindeki doğrulama betiklerinden (scripts/verify-*.ts) kalan TEST kayıtlarını temizler.
 *
 *   npx tsx scripts/cleanup-demo-test-data.ts --company "Sare Havuz & Spa"          # yalnızca LİSTELER
 *   npx tsx scripts/cleanup-demo-test-data.ts --company "Sare Havuz & Spa" --apply  # uygular
 *
 * - Varsayılan KURU ÇALIŞMA: hiçbir şey yazmaz, yalnızca eşleşen kayıtları listeler.
 * - --apply ile bile HİÇBİR KAYIT FİZİKSEL SİLİNMEZ: deletedAt işaretlenir (yumuşak silme),
 *   tahsilatlar "iptal" edilir — gerekirse geri alınabilir.
 * - Eşleşme kuralı: adında/açıklamasında "test" geçen müşteri, tedarikçi, ürün, personel, gider;
 *   test müşterilerinin teklif/sipariş/tahsilatları; test tedarikçilerinin satın almaları.
 */
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass, withTenant } from "../src/lib/db/tenant-context";

const TEST = { contains: "test", mode: "insensitive" } as const;
const REASON = "Demo test verisi temizliği";

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const companyName = arg("--company");
  const apply = process.argv.includes("--apply");
  if (!companyName) throw new Error('--company "Şirket Adı" gerekli.');

  console.log(`Veritabanı sunucusu: ${new URL(process.env.APP_DATABASE_URL!).hostname.split(".")[0]}`);
  console.log(apply ? "MOD: UYGULA (yumuşak silme)\n" : "MOD: KURU ÇALIŞMA — hiçbir şey değişmeyecek\n");

  const companies = await withPlatformBypass((tx) =>
    tx.company.findMany({ where: { name: companyName, deletedAt: null }, select: { id: true, name: true } }),
  );
  if (companies.length !== 1) throw new Error(`"${companyName}" adında tam 1 şirket bekleniyordu, bulunan: ${companies.length}`);
  const companyId = companies[0].id;

  await withTenant(
    companyId,
    async (tx) => {
      const live = { companyId, deletedAt: null };
      const customers = await tx.customer.findMany({ where: { ...live, title: TEST }, select: { id: true, title: true } });
      const customerIds = customers.map((c) => c.id);
      const quotes = await tx.quote.findMany({ where: { ...live, customerId: { in: customerIds } }, select: { id: true, number: true } });
      const orders = await tx.order.findMany({ where: { ...live, customerId: { in: customerIds } }, select: { id: true, number: true } });
      const payments = await tx.payment.findMany({
        where: { companyId, isCancelled: false, customerId: { in: customerIds } },
        select: { id: true, amount: true },
      });
      const expenses = await tx.expense.findMany({
        where: { ...live, OR: [{ vendor: TEST }, { note: TEST }] },
        select: { id: true, vendor: true, amount: true },
      });
      const products = await tx.product.findMany({ where: { ...live, name: TEST }, select: { id: true, name: true } });
      const suppliers = await tx.supplier.findMany({ where: { ...live, title: TEST }, select: { id: true, title: true } });
      const purchaseOrders = await tx.purchaseOrder.findMany({
        where: { ...live, supplierId: { in: suppliers.map((s) => s.id) } },
        select: { id: true },
      });
      const employees = await tx.employee.findMany({ where: { ...live, fullName: TEST }, select: { id: true, fullName: true } });

      const show = (label: string, rows: string[]) => {
        console.log(`${label}: ${rows.length}`);
        rows.slice(0, 25).forEach((r) => console.log(`   - ${r}`));
        if (rows.length > 25) console.log(`   … ve ${rows.length - 25} tane daha`);
      };
      show("Müşteri", customers.map((c) => c.title));
      show("  └ Teklif", quotes.map((q) => q.number));
      show("  └ Sipariş", orders.map((o) => o.number));
      show("  └ Tahsilat", payments.map((p) => `${Number(p.amount)} ₺`));
      show("Gider", expenses.map((e) => `${e.vendor ?? "—"} · ${Number(e.amount)} ₺`));
      show("Ürün", products.map((p) => p.name));
      show("Tedarikçi", suppliers.map((s) => s.title));
      show("  └ Satın alma", purchaseOrders.map((p) => p.id.slice(0, 8)));
      show("Personel", employees.map((e) => e.fullName));

      // Bilgi amaçlı: test adı taşımayan ama demo'yu bozabilecek büyük giderler (DOKUNULMAZ).
      const big = await tx.expense.findMany({
        where: { ...live, amount: { gte: 100_000 } },
        select: { vendor: true, amount: true, spentAt: true, category: { select: { name: true } } },
        orderBy: { amount: "desc" },
        take: 10,
      });
      if (big.length) {
        console.log("\nBilgi — 100.000 ₺ üzeri giderler (bu betik DOKUNMAZ, kontrol edin):");
        big.forEach((e) =>
          console.log(`   - ${e.category.name} · ${e.vendor ?? "—"} · ${Number(e.amount)} ₺ · ${e.spentAt.toISOString().slice(0, 10)}`),
        );
      }

      if (!apply) {
        console.log("\nKuru çalışma bitti. Uygulamak için aynı komutu --apply ile çalıştırın.");
        return;
      }

      const now = new Date();
      const ids = (rows: { id: string }[]) => ({ id: { in: rows.map((r) => r.id) } });
      await tx.payment.updateMany({ where: ids(payments), data: { isCancelled: true, cancelledAt: now, cancelReason: REASON } });
      await tx.order.updateMany({ where: ids(orders), data: { deletedAt: now } });
      await tx.quote.updateMany({ where: ids(quotes), data: { deletedAt: now } });
      await tx.customer.updateMany({ where: ids(customers), data: { deletedAt: now } });
      await tx.expense.updateMany({ where: ids(expenses), data: { deletedAt: now } });
      await tx.purchaseOrder.updateMany({ where: ids(purchaseOrders), data: { deletedAt: now } });
      await tx.supplier.updateMany({ where: ids(suppliers), data: { deletedAt: now } });
      await tx.product.updateMany({ where: ids(products), data: { deletedAt: now } });
      await tx.employee.updateMany({ where: ids(employees), data: { deletedAt: now } });
      console.log("\nUygulandı (yumuşak silme). Geri almak için deleted_at alanları temizlenebilir.");
    },
    { timeoutMs: 60_000 },
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
