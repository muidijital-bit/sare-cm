// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Projeler modülü uçtan uca doğrulaması (YALNIZCA geliştirme veritabanında çalıştırın — canlıda
 * ÇALIŞTIRMAYIN: test kaydı oluşturur; sonda temizlese de yarıda kesilirse artık bırakır):
 * yetki matrisi, proje CRUD + numaralandırma, malzeme → stok düşümü/iadesi, işçilik, hakediş
 * siparişi + tahsilat mahsubu, proje gideri, kârlılık özeti, satış rolünün "own" kapsamı,
 * başka müşterinin projesine sipariş bağlama reddi, RLS şirketler arası izolasyon.
 */
import { randomUUID } from "crypto";
import { withPlatformBypass, withTenant } from "../src/lib/db/tenant-context";
import {
  createProject,
  getProject,
  updateProject,
  deleteProject,
  addProjectMaterial,
  deleteProjectMaterial,
  addProjectLabor,
  listProjects,
} from "../src/lib/modules/projects/service";
import { createOrder, cancelOrder } from "../src/lib/modules/orders/service";
import { createPayment } from "../src/lib/modules/payments/service";
import { createExpense } from "../src/lib/modules/expenses/service";
import { getScope } from "../src/lib/auth/access";
import type { TenantSession } from "../src/lib/auth/session";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) console.log(`✅ ${label}`);
  else {
    console.error(`❌ ${label}`);
    failures++;
  }
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

async function main() {
  const host = new URL(process.env.APP_DATABASE_URL!).hostname;
  if (process.env.PROD_APP_DATABASE_URL && host === new URL(process.env.PROD_APP_DATABASE_URL).hostname) {
    throw new Error("Bu doğrulama betiği canlı veritabanında çalıştırılamaz.");
  }

  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const company = await withPlatformBypass((tx) => tx.company.findFirstOrThrow({ where: { name: "Sare Havuz & Spa", deletedAt: null } }));
  const account = await withPlatformBypass((tx) => tx.account.findFirstOrThrow({ where: { companyId: company.id, isActive: true } }));
  const category = await withPlatformBypass((tx) => tx.expenseCategory.findFirstOrThrow({ where: { companyId: company.id, deletedAt: null } }));

  const base: TenantSession = {
    userId: owner.id, userName: owner.name, userEmail: owner.email, companyId: company.id, companyName: company.name,
    companyStatus: "ACTIVE", role: "OWNER", enabledModules: ["*"], membershipCount: 1,
  };
  const sales: TenantSession = { ...base, userId: randomUUID(), role: "SALES" };
  const accounting: TenantSession = { ...base, role: "ACCOUNTING" };

  check("yetki: OWNER proje → all", getScope(base, "project", "view") === "all");
  check("yetki: SALES proje görüntüleme → own", getScope(sales, "project", "view") === "own");
  check("yetki: SALES proje silme → yasak", getScope(sales, "project", "delete") === null);
  check("yetki: ACCOUNTING proje oluşturma → yasak, düzenleme → all", getScope(accounting, "project", "create") === null && getScope(accounting, "project", "edit") === "all");
  check("lisans: modül kapalıysa → yasak", getScope({ ...base, enabledModules: ["dashboard", "customer"] }, "project", "view") === null);

  const tag = randomUUID().slice(0, 6);
  const created = { customerIds: [] as string[], productId: "", projectId: "", orderIds: [] as string[], paymentIds: [] as string[], expenseIds: [] as string[] };

  try {
    // Test verisi: 2 müşteri + stok takipli ürün
    const [cust, otherCust, product] = await withTenant(company.id, async (tx) => [
      await tx.customer.create({ data: { companyId: company.id, title: `__Proje Test Müşteri ${tag}`, type: "CORPORATE", ownerUserId: owner.id, createdBy: owner.id } }),
      await tx.customer.create({ data: { companyId: company.id, title: `__Proje Test Diğer ${tag}`, type: "CORPORATE", ownerUserId: owner.id, createdBy: owner.id } }),
      await tx.product.create({ data: { companyId: company.id, name: `__Test Havuz Lambası ${tag}`, unit: "adet", listPrice: 1500, defaultCost: 800, vatRate: 20, stockQty: 0 } }),
    ] as const);
    created.customerIds.push(cust.id, otherCust.id);
    created.productId = product.id;

    // 1) Proje oluştur
    const pr = await createProject(base, {
      name: "Test Villa Havuzu", customerId: cust.id, status: "IN_PROGRESS", location: "Bodrum",
      startDate: new Date("2026-09-01"), endDate: null, contractAmount: 100000, note: "",
    });
    check("proje oluşturuldu", pr.ok);
    if (!pr.ok) return;
    created.projectId = pr.data.id;
    const d0 = await getProject(base, pr.data.id);
    check("proje numarası PRJ-YYYY-NNNN", d0.ok && /^PRJ-\d{4}-\d{4}$/.test(d0.data.project.number));

    // 2) Malzeme → stok düşer (varsayılan maliyet 800 kullanılır)
    const m1 = await addProjectMaterial(base, pr.data.id, { productId: product.id, quantity: 8, usedAt: new Date(), note: "" });
    check("malzeme eklendi", m1.ok);
    const stockAfter = await withTenant(company.id, (tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    check("stok 8 düştü (0 → -8)", Number(stockAfter.stockQty) === -8);
    const mv = await withTenant(company.id, (tx) => tx.stockMovement.findFirst({ where: { productId: product.id, type: "PROJECT_CONSUMED" } }));
    check("stok hareketi PROJECT_CONSUMED ve malzeme kaydına bağlı", !!mv && mv.projectMaterialId === (m1.ok ? m1.data.id : ""));

    // Elle maliyetli ikinci kayıt, sonra silinip stoğa geri dönüyor mu
    const m2 = await addProjectMaterial(base, pr.data.id, { productId: product.id, quantity: 2, unitCost: 900, usedAt: new Date(), note: "" });
    check("elle maliyetli malzeme eklendi", m2.ok);
    if (m2.ok) {
      const del = await deleteProjectMaterial(base, pr.data.id, m2.data.id);
      check("malzeme silindi", del.ok);
      const s2 = await withTenant(company.id, (tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
      check("silinen malzeme stoğa geri eklendi (-8)", Number(s2.stockQty) === -8);
    }

    // 3) İşçilik: 2 kişi × 10 saat × 150 = 3000
    const l1 = await addProjectLabor(base, pr.data.id, { employeeId: null, description: "Kazı", workDate: new Date(), hours: 20, hourlyCost: 150 });
    check("işçilik eklendi", l1.ok);

    // 4) Hakediş siparişi (KDV hariç 60.000) + başka müşterinin projesine bağlama reddi
    const orderInput = {
      customerId: cust.id, projectId: pr.data.id, orderDate: new Date(), dueDate: null, deliveryAddress: "", ownerUserId: null, note: "",
      documentDiscount: null, paymentSchedules: [],
      items: [{ description: "1. hakediş", quantity: 1, unit: "adet", unitPrice: 60000, unitCost: null, discountType: "PERCENT" as const, discountValue: 0, vatRate: 20 }],
    };
    const o1 = await createOrder(base, orderInput);
    check("hakediş siparişi projeye bağlı oluşturuldu", o1.ok);
    if (o1.ok) created.orderIds.push(o1.data.id);
    const bad = await createOrder(base, { ...orderInput, customerId: otherCust.id });
    check("başka müşterinin projesine sipariş bağlama → reddedildi", !bad.ok);

    // 5) Tahsilat 30.000 (mahsup) + proje gideri 5.000
    if (o1.ok) {
      const pay = await createPayment(base, {
        customerId: cust.id, accountId: account.id, paidAt: new Date(), amount: 30000, method: "BANK_TRANSFER", reference: "", note: "",
        allocations: [{ orderId: o1.data.id, amount: 30000 }],
      });
      check("tahsilat mahsup edildi", pay.ok);
      if (pay.ok) created.paymentIds.push(pay.data.id);
    }
    const ex = await createExpense(base, {
      categoryId: category.id, spentAt: new Date(), amount: 5000, vatAmount: 0, vendor: "__Test nakliye", method: null, accountId: null, note: "",
      projectId: pr.data.id, isRecurringTemplate: false, recurringRule: null,
    });
    check("proje gideri eklendi", ex.ok);
    if (ex.ok) created.expenseIds.push(ex.data.id);

    // 6) Kârlılık özeti: faturalanan 60.000; maliyet = 8×800 + 20×150 + 5000 = 14.400; kâr 45.600
    const d1 = await getProject(base, pr.data.id);
    if (d1.ok) {
      const s = d1.data.summary;
      check(`özet: faturalanan 60.000 (${s.billed})`, near(s.billed, 60000));
      check(`özet: kalan hakediş 40.000 (${s.remainingToBill})`, near(s.remainingToBill, 40000));
      check(`özet: tahsil 30.000 (${s.collected})`, near(s.collected, 30000));
      check(`özet: malzeme 6.400 (${s.materialCost})`, near(s.materialCost, 6400));
      check(`özet: işçilik 3.000 (${s.laborCost})`, near(s.laborCost, 3000));
      check(`özet: gider 5.000 (${s.expenseCost})`, near(s.expenseCost, 5000));
      check(`özet: kâr 45.600 (${s.profit})`, near(s.profit, 45600));
      check(`özet: marj %76 (${s.marginPct?.toFixed(1)})`, s.marginPct != null && near(s.marginPct, 76));
    } else check("proje detayı okunamadı", false);

    // 7) İptal edilen sipariş gelire sayılmaz
    if (o1.ok) {
      const c = await cancelOrder(base, o1.data.id, "test");
      const d2 = await getProject(base, pr.data.id);
      check("iptal edilen hakediş faturalanandan düştü", !c.ok || (d2.ok && near(d2.data.summary.billed, 0)));
    }

    // 8) Satış rolü: başkasının projesini göremez / düzenleyemez
    const sv = await getProject(sales, pr.data.id);
    check("SALES: başkasının projesi → 403", !sv.ok && sv.status === 403);
    const sl = await listProjects(sales, { page: 1, pageSize: 50 });
    check("SALES: listede başkasının projesi yok", sl.ok && !sl.data.items.some((x) => x.id === pr.data.id));
    const su = await updateProject(sales, pr.data.id, { name: "x", customerId: cust.id, status: "PLANNED", location: "", startDate: null, endDate: null, contractAmount: 0, note: "" });
    check("SALES: başkasının projesini düzenleme → 403", !su.ok && su.status === 403);

    // 9) RLS: başka şirket bağlamında proje/malzeme görünmez
    const other = await withPlatformBypass((tx) => tx.company.findFirst({ where: { id: { not: company.id }, deletedAt: null } }));
    if (other) {
      const [projSeen, matSeen, laborSeen] = await withTenant(other.id, async (tx) => [
        await tx.project.count({ where: { id: pr.data.id } }),
        await tx.projectMaterial.count({ where: { projectId: pr.data.id } }),
        await tx.projectLabor.count({ where: { projectId: pr.data.id } }),
      ]);
      check("RLS: başka şirket projeyi göremez", projSeen === 0);
      check("RLS: başka şirket malzemeyi göremez", matSeen === 0);
      check("RLS: başka şirket işçiliği göremez", laborSeen === 0);
      let blocked = false;
      try {
        await withTenant(other.id, (tx) => tx.projectLabor.create({ data: { companyId: company.id, projectId: pr.data.id, description: "sızma", workDate: new Date(), hours: 1, hourlyCost: 1, createdBy: owner.id } }));
      } catch {
        blocked = true;
      }
      check("RLS: başka şirket adına kayıt yazılamaz (WITH CHECK)", blocked);
    } else console.log("ℹ️  İkinci şirket yok — RLS çapraz testi atlandı");

    // 10) Silme: malzeme stoğa geri döner (-8 → 0)
    const delRes = await deleteProject(base, pr.data.id);
    check("proje silindi (bağlı aktif sipariş yok)", delRes.ok);
    const s3 = await withTenant(company.id, (tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    check("proje silinince malzeme stoğa döndü (0)", Number(s3.stockQty) === 0);
  } finally {
    // Temizlik — test kayıtlarını tamamen kaldır (sıra: FK bağımlılıkları).
    await withPlatformBypass(async (tx) => {
      if (created.paymentIds.length) {
        await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: created.paymentIds } } });
        await tx.payment.deleteMany({ where: { id: { in: created.paymentIds } } });
      }
      if (created.orderIds.length) {
        await tx.stockMovement.deleteMany({ where: { orderId: { in: created.orderIds } } });
        await tx.paymentSchedule.deleteMany({ where: { orderId: { in: created.orderIds } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: created.orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: created.orderIds } } });
      }
      if (created.expenseIds.length) await tx.expense.deleteMany({ where: { id: { in: created.expenseIds } } });
      if (created.projectId) {
        await tx.projectLabor.deleteMany({ where: { projectId: created.projectId } });
        await tx.projectMaterial.deleteMany({ where: { projectId: created.projectId } });
        await tx.project.deleteMany({ where: { id: created.projectId } });
      }
      if (created.productId) {
        await tx.stockMovement.deleteMany({ where: { productId: created.productId } });
        await tx.product.deleteMany({ where: { id: created.productId } });
      }
      if (created.customerIds.length) await tx.customer.deleteMany({ where: { id: { in: created.customerIds } } });
      await tx.auditLog.deleteMany({ where: { entityId: { in: [created.projectId, ...created.orderIds, ...created.expenseIds, ...created.paymentIds].filter(Boolean) } } });
    });
    console.log("🧹 Test verisi temizlendi");
  }

  console.log(failures === 0 ? "\nTÜM KONTROLLER GEÇTİ" : `\n${failures} KONTROL BAŞARISIZ`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
