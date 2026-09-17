/**
 * `scripts/seed-demo-showcase.ts` ile eklenen TÜM sunum verisini geri alır.
 * Yalnızca "DEMO-SUNUM" işaretli kayıtları siler (customer.address / not alanları) —
 * gerçek/kalıcı seed verisine (Demo Sahip kullanıcısı, plan, kasa hesabı vb.) dokunmaz.
 * Şirket ADI ("Sare Havuz & Spa") kasıtlı olarak GERİ ALINMAZ — sunumdan sonra da kalabilir;
 * gerekirse ayrıca değiştirin.
 *
 * Çalıştırma: npx tsx scripts/cleanup-demo-showcase.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";

const DEMO_MARKER = "DEMO-SUNUM";
const COMPANY_ID = "00000000-0000-0000-0000-000000000002";

async function main() {
  console.log("Sunum verisi temizleniyor...");

  const result = await withPlatformBypass(async (tx) => {
    const customers = await tx.customer.findMany({ where: { companyId: COMPANY_ID, address: DEMO_MARKER }, select: { id: true } });
    const customerIds = customers.map((c) => c.id);

    const allocDeleted = await tx.paymentAllocation.deleteMany({ where: { order: { customerId: { in: customerIds } } } });
    const paymentsDeleted = await tx.payment.deleteMany({ where: { companyId: COMPANY_ID, customerId: { in: customerIds } } });
    const orderItemsDeleted = await tx.orderItem.deleteMany({ where: { order: { customerId: { in: customerIds } } } });
    const ordersDeleted = await tx.order.deleteMany({ where: { companyId: COMPANY_ID, customerId: { in: customerIds } } });
    const quoteItemsDeleted = await tx.quoteItem.deleteMany({ where: { quote: { customerId: { in: customerIds } } } });
    const quotesDeleted = await tx.quote.deleteMany({ where: { companyId: COMPANY_ID, customerId: { in: customerIds } } });
    const activitiesDeleted = await tx.activity.deleteMany({ where: { customerId: { in: customerIds } } });
    const customersDeleted = await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
    const expensesDeleted = await tx.expense.deleteMany({ where: { companyId: COMPANY_ID, note: DEMO_MARKER } });
    const auditDeleted = await tx.auditLog.deleteMany({
      where: {
        companyId: COMPANY_ID,
        entityType: { in: ["quote", "order", "payment", "expense", "customer"] },
        entityId: { in: [...customerIds] },
      },
    });

    return {
      customersDeleted: customersDeleted.count,
      quotesDeleted: quotesDeleted.count,
      quoteItemsDeleted: quoteItemsDeleted.count,
      ordersDeleted: ordersDeleted.count,
      orderItemsDeleted: orderItemsDeleted.count,
      allocDeleted: allocDeleted.count,
      paymentsDeleted: paymentsDeleted.count,
      expensesDeleted: expensesDeleted.count,
      activitiesDeleted: activitiesDeleted.count,
      auditDeleted: auditDeleted.count,
    };
  });

  console.log(result);
  console.log("\n🎉 Sunum verisi temizlendi. (Not: gider kategorileri 'Kimyasal Malzeme'/'Bakım ve Onarım' kalıcı olarak bırakıldı, isterseniz elle silin.)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
