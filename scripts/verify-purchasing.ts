// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler (next dev/build'in aksine) .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Tedarikçi / Satın Alma / Stok modülü uçtan uca doğrulaması: yetki, stok mutabakatı
 * (oluştur/düzenle/iptal), alım teslim alma, manuel düzeltme, RLS izolasyonu. Test verisi
 * sonunda tamamen temizlenir.
 */
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { createSupplier } from "../src/lib/modules/suppliers/service";
import { createPurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder, getPurchaseOrder, adjustStock, getProductStock } from "../src/lib/modules/purchase-orders/service";
import { createOrder, updateOrder, cancelOrder } from "../src/lib/modules/orders/service";
import { getScope } from "../src/lib/auth/access";
import type { TenantSession } from "../src/lib/auth/session";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) console.log(`✅ ${label}`);
  else { console.error(`❌ ${label}`); failures++; }
}

async function main() {
  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const company = await withPlatformBypass((tx) => tx.company.findFirstOrThrow({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } }));
  const customer = await withPlatformBypass((tx) => tx.customer.findFirstOrThrow({ where: { companyId: company.id, deletedAt: null } }));

  const base: TenantSession = {
    userId: owner.id, userName: owner.name, userEmail: owner.email, companyId: company.id, companyName: company.name,
    companyStatus: "ACTIVE", role: "OWNER", enabledModules: ["*"], membershipCount: 1,
  };
  const salesSession: TenantSession = { ...base, role: "SALES" };

  check("getScope: SALES + supplier → YASAK", getScope(salesSession, "supplier", "view") === null);
  check("getScope: OWNER + supplier → serbest", getScope(base, "supplier", "view") === "all");

  // Test ürünü (stok sıfırdan başlasın diye ayrı, sonunda silinir)
  const product = await withPlatformBypass((tx) =>
    tx.product.create({ data: { companyId: company.id, name: `__test_urun_${Date.now()}`, unit: "adet", listPrice: 100, vatRate: 20 } }),
  );

  let supplierId = "";
  let poId = "";
  let orderId = "";
  try {
    // 1) Tedarikçi
    const supRes = await createSupplier(base, { title: "__Test Tedarikçi__", taxOffice: "", taxNumber: "", address: "", phone: "", email: "", isActive: true });
    check("Tedarikçi oluşturuldu", supRes.ok);
    if (!supRes.ok) return;
    supplierId = supRes.data.id;

    // 2) Satın alma (DRAFT) — stok henüz değişmemeli
    const poRes = await createPurchaseOrder(base, { supplierId, orderedAt: new Date(), note: "", items: [{ productId: product.id, description: "Test satır", quantity: 10, unitCost: 15, vatRate: 20 }] });
    check("Satın alma (taslak) oluşturuldu", poRes.ok);
    if (!poRes.ok) return;
    poId = poRes.data.id;

    let p = await withPlatformBypass((tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    check("Taslak alım stoğu ETKİLEMEDİ (0)", Number(p.stockQty) === 0);

    // 3) Teslim al — stok +10, maliyet 15 olmalı
    const recvRes = await receivePurchaseOrder(base, poId);
    check("Alım teslim alındı", recvRes.ok);
    p = await withPlatformBypass((tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    check("Teslim alınca stok +10", Number(p.stockQty) === 10);
    check("Ürün maliyeti alım fiyatına güncellendi (15)", Number(p.defaultCost) === 15);

    const detail = await getPurchaseOrder(base, poId);
    check("Alım detayı: toplam doğru (10×15×1.2=180)", detail.ok && Math.abs(Number(detail.data.total) - 180) < 0.01);

    // 4) Sipariş oluştur (5 adet) — stok 10 -> 5
    const orderRes = await createOrder(base, {
      customerId: customer.id, orderDate: new Date(), dueDate: null, deliveryAddress: "", ownerUserId: null, note: "",
      documentDiscount: null, items: [{ productId: product.id, description: "Satış", quantity: 5, unit: "adet", unitPrice: 50, unitCost: null, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
      paymentSchedules: [],
    });
    check("Sipariş oluşturuldu", orderRes.ok);
    if (!orderRes.ok) return;
    orderId = orderRes.data.id;
    p = await withPlatformBypass((tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    check("Sipariş oluşunca stok -5 (10→5)", Number(p.stockQty) === 5);

    // 5) Siparişi düzenle (8 adete çıkar) — stok 5 -> 2 (net -8 rezervasyon)
    const updRes = await updateOrder(base, orderId, {
      customerId: customer.id, orderDate: new Date(), dueDate: null, deliveryAddress: "", ownerUserId: null, note: "",
      documentDiscount: null, items: [{ productId: product.id, description: "Satış", quantity: 8, unit: "adet", unitPrice: 50, unitCost: null, discountType: "PERCENT", discountValue: 0, vatRate: 20 }],
      paymentSchedules: [],
    });
    check("Sipariş düzenlendi (miktar 5→8)", updRes.ok);
    p = await withPlatformBypass((tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    check("Düzenleme sonrası stok doğru mutabakatlandı (10-8=2)", Number(p.stockQty) === 2);

    // 6) Siparişi iptal et — stok tamamen geri gelmeli (10)
    const cancelRes = await cancelOrder(base, orderId, "test iptali");
    check("Sipariş iptal edildi", cancelRes.ok);
    p = await withPlatformBypass((tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    check("İptalde stok tamamen geri geldi (10)", Number(p.stockQty) === 10);

    // 7) Manuel düzeltme (-3, sayım farkı)
    const adjRes = await adjustStock(base, { productId: product.id, quantity: -3, note: "Sayım farkı testi" });
    check("Manuel stok düzeltmesi uygulandı", adjRes.ok);
    p = await withPlatformBypass((tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    check("Düzeltme sonrası stok 7 (10-3)", Number(p.stockQty) === 7);

    const stockDetail = await getProductStock(base, product.id);
    check("Ürün stok geçmişi: en az 3 hareket (alım+sipariş+iptal+düzeltme)", stockDetail.ok && stockDetail.data.movements.length >= 3);

    // 8) Alım iptali — RECEIVED bir alımı iptal edince stok/maliyetten düşmeli
    const po2Res = await createPurchaseOrder(base, { supplierId, orderedAt: new Date(), note: "", items: [{ productId: product.id, description: "İkinci alım", quantity: 4, unitCost: 20, vatRate: 20 }] });
    if (po2Res.ok) {
      await receivePurchaseOrder(base, po2Res.data.id);
      p = await withPlatformBypass((tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
      check("2. alım teslim alınınca stok +4 (7→11)", Number(p.stockQty) === 11);
      const cancelPoRes = await cancelPurchaseOrder(base, po2Res.data.id);
      check("Teslim alınmış alım iptal edildi", cancelPoRes.ok);
      p = await withPlatformBypass((tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
      check("Alım iptalinde stok geri alındı (11→7)", Number(p.stockQty) === 7);
    }

    // 9) RLS izolasyonu: başka bir şirketten bu tedarikçiye erişim
    const otherCompany = await withPlatformBypass((tx) => tx.company.findFirst({ where: { id: { not: company.id }, deletedAt: null } }));
    if (otherCompany) {
      const crossSession: TenantSession = { ...base, companyId: otherCompany.id };
      const crossRes = await createPurchaseOrder(crossSession, { supplierId, orderedAt: new Date(), note: "", items: [{ productId: null, description: "x", quantity: 1, unitCost: 1, vatRate: 0 }] });
      check("RLS: başka şirket bu tedarikçiyi göremiyor (notFound)", !crossRes.ok && crossRes.status === 404);
    }

    // 10) Çekirdek olmayan modül kapalıyken 403
    const noModuleSession: TenantSession = { ...base, enabledModules: [] };
    check("Lisanssız: supplier modülü kapalıyken YASAK", getScope(noModuleSession, "supplier", "view") === null);
  } finally {
    // Temizlik: sırayla bağımlılıkları sil
    await withPlatformBypass(async (tx) => {
      if (orderId) {
        await tx.stockMovement.deleteMany({ where: { orderId } });
        await tx.paymentAllocation.deleteMany({ where: { order: { id: orderId } } });
        await tx.paymentSchedule.deleteMany({ where: { orderId } });
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.order.delete({ where: { id: orderId } }).catch(() => {});
      }
      const purchaseOrders = await tx.purchaseOrder.findMany({ where: { supplierId }, select: { id: true } });
      for (const po of purchaseOrders) {
        await tx.stockMovement.deleteMany({ where: { purchaseOrderId: po.id } });
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } });
        await tx.purchaseOrder.delete({ where: { id: po.id } });
      }
      await tx.stockMovement.deleteMany({ where: { productId: product.id } });
      await tx.auditLog.deleteMany({ where: { entityId: { in: [supplierId, product.id, orderId, poId].filter(Boolean) } } });
      if (supplierId) await tx.supplier.delete({ where: { id: supplierId } }).catch(() => {});
      await tx.product.delete({ where: { id: product.id } });
    });
    console.log("· test verisi temizlendi");
  }

  console.log(failures === 0 ? "\n🎉 Tedarikçi/Satın Alma/Stok modülü tüm kontrollerden geçti." : `\n${failures} KONTROL BAŞARISIZ`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
