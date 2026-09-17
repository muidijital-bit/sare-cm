/**
 * Teklif → Sipariş → Tahsilat akışını CANLI veritabanına karşı uçtan uca doğrular:
 * teklif oluşturma/hesaplama, durum makinesi (gönder/kabul/red), revizyon, tekliften
 * sipariş oluşturma, ödeme planı, mahsuplaşma, kısmi/fazla ödeme, SP-08 tutar düşürme
 * engeli, iptal, vadesi geçmiş alacaklar.
 *
 * Çalıştırma: npx tsx scripts/verify-sales-flow.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../src/lib/db/prisma";
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import {
  createQuote,
  getQuote,
  sendQuote,
  acceptQuote,
  rejectQuote,
  createRevision,
  updateQuote,
} from "../src/lib/modules/quotes/service";
import { createOrderFromQuote, getOrder, updateOrder, advanceOrderStatus, cancelOrder } from "../src/lib/modules/orders/service";
import { createPayment, cancelPayment, listOverdueReceivables } from "../src/lib/modules/payments/service";
import type { TenantSession } from "../src/lib/auth/session";
import type { QuoteInput } from "../src/lib/validation/quote";

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000002";
const DEMO_ACCOUNT_ID = "00000000-0000-0000-0000-000000000010";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`✅ ${label}`);
  else {
    console.error(`❌ ${label}`);
    failures++;
  }
}

async function main() {
  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const session: TenantSession = {
    userId: owner.id,
    userName: owner.name,
    userEmail: owner.email,
    companyId: DEMO_COMPANY_ID,
    companyName: "Demo Şirket A.Ş.",
    companyStatus: "ACTIVE",
    role: "OWNER",
    membershipCount: 1,
  };

  const customer = await withPlatformBypass((tx) =>
    tx.customer.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        type: "CORPORATE",
        title: `Satış Test Müşteri ${randomUUID().slice(0, 8)}`,
        status: "ACTIVE",
        ownerUserId: owner.id,
        createdBy: owner.id,
      },
    }),
  );

  // 1) Teklif oluşturma — 2 satır, satır iskontosu + KDV, hesaplamaları doğrula
  const quoteInput: QuoteInput = {
    customerId: customer.id,
    contactId: null,
    issueDate: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    ownerUserId: owner.id,
    note: "Test teklifi",
    documentDiscount: null,
    items: [
      { description: "Danışmanlık", quantity: 10, unit: "saat", unitPrice: 100, discountType: "PERCENT", discountValue: 10, vatRate: 20 },
      { description: "Kurulum", quantity: 1, unit: "adet", unitPrice: 500, discountType: "AMOUNT", discountValue: 0, vatRate: 20 },
    ],
  };
  const createResult = await createQuote(session, quoteInput);
  assert(createResult.ok, "Teklif oluşturuldu");
  if (!createResult.ok) return report();
  const quoteId = createResult.data.id;

  // Beklenen: satır1 net = 10*100 - %10 = 900, satır2 net = 500 → subtotal(brüt)=1500,
  // discountTotal=100, netTotal=1400, vatTotal=280, grandTotal=1680
  const q1 = await getQuote(session, quoteId);
  assert(q1.ok && q1.data.status === "DRAFT", "Yeni teklif taslak durumunda");
  assert(q1.ok && Number(q1.data.subtotal) === 1500, `Ara toplam doğru (${q1.ok ? q1.data.subtotal : "-"})`);
  assert(q1.ok && Number(q1.data.discountTotal) === 100, `İskonto toplamı doğru (${q1.ok ? q1.data.discountTotal : "-"})`);
  assert(q1.ok && Number(q1.data.vatTotal) === 280, `KDV toplamı doğru (${q1.ok ? q1.data.vatTotal : "-"})`);
  assert(q1.ok && Number(q1.data.grandTotal) === 1680, `Genel toplam doğru (${q1.ok ? q1.data.grandTotal : "-"})`);
  assert(!!q1.ok && /^TKF-\d{4}-\d{4}$/.test(q1.data.number), `Teklif numarası doğru formatta (${q1.ok ? q1.data.number : "-"})`);

  // 2) Taslak düzenlenebilir, ama gönderilince düzenlenemez (TK-10)
  const editDraft = await updateQuote(session, quoteId, quoteInput);
  assert(editDraft.ok, "Taslak teklif düzenlenebiliyor");

  const sendResult = await sendQuote(session, quoteId);
  assert(sendResult.ok && sendResult.data.status === "SENT", "Teklif gönderildi");

  const editAfterSend = await updateQuote(session, quoteId, quoteInput);
  assert(!editAfterSend.ok && editAfterSend.status === 409, "Gönderilmiş teklif düzenlenemiyor (409)");

  // 3) Geçersiz durum geçişi reddedilir (SENT'ten tekrar SENT olamaz / DRAFT'a dönemez)
  const invalidSend = await sendQuote(session, quoteId);
  assert(!invalidSend.ok, "SENT durumundaki teklif tekrar gönderilemiyor");

  // 4) Kabul
  const acceptResult = await acceptQuote(session, quoteId);
  assert(acceptResult.ok && acceptResult.data.status === "ACCEPTED", "Teklif kabul edildi");

  // 5) Revizyon — yeni bir taslak, numarası -R2
  const revisionResult = await createRevision(session, quoteId);
  assert(revisionResult.ok, "Revizyon oluşturuldu");
  if (revisionResult.ok) {
    const rev = await getQuote(session, revisionResult.data.id);
    assert(rev.ok && rev.data.status === "DRAFT" && rev.data.number.endsWith("-R2"), `Revizyon numarası doğru (${rev.ok ? rev.data.number : "-"})`);
  }

  // 6) Tekliften sipariş — TK-08
  const convertResult = await createOrderFromQuote(session, quoteId);
  assert(convertResult.ok, "Kabul edilen teklif siparişe dönüştürüldü");
  if (!convertResult.ok) return report();
  const orderId = convertResult.data.id;

  const secondConvert = await createOrderFromQuote(session, quoteId);
  assert(!secondConvert.ok && secondConvert.status === 409, "Aynı teklif ikinci kez siparişe dönüştürülemiyor");

  const o1 = await getOrder(session, orderId);
  assert(o1.ok && Number(o1.data.grandTotal) === 1680, "Sipariş tutarı teklifle birebir aynı");
  assert(o1.ok && o1.data.status === "CONFIRMED", "Yeni sipariş 'onaylandı' durumunda");

  // 7) Kısmi tahsilat + mahsuplaşma (TH-03/TH-04)
  const partialPayment = await createPayment(session, {
    customerId: customer.id,
    accountId: DEMO_ACCOUNT_ID,
    paidAt: new Date(),
    amount: 1000,
    method: "BANK_TRANSFER",
    reference: "TEST-REF-1",
    note: "",
    allocations: [{ orderId, amount: 1000 }],
  });
  assert(partialPayment.ok, "Kısmi tahsilat + mahsup başarılı");

  // 8) Kalan bakiyeyi aşan mahsup reddedilir
  const overAllocate = await createPayment(session, {
    customerId: customer.id,
    accountId: DEMO_ACCOUNT_ID,
    paidAt: new Date(),
    amount: 1000,
    method: "CASH",
    reference: "",
    note: "",
    allocations: [{ orderId, amount: 1000 }], // kalan yalnızca 680
  });
  assert(!overAllocate.ok && overAllocate.status === 409, "Kalan bakiyeyi aşan mahsup reddediliyor (409)");

  // 9) SP-08 — tahsilat yapılmış siparişin tutarı düşürülemez
  const lowerAmountInput = {
    customerId: customer.id,
    quoteId: null,
    orderDate: o1.ok ? o1.data.orderDate : new Date(),
    dueDate: null,
    deliveryAddress: "",
    ownerUserId: owner.id,
    note: "",
    documentDiscount: null,
    items: [{ description: "Tek satır", quantity: 1, unit: "adet", unitPrice: 100, discountType: "PERCENT" as const, discountValue: 0, vatRate: 20 }],
    paymentSchedules: [],
  };
  const lowerAttempt = await updateOrder(session, orderId, lowerAmountInput);
  assert(!lowerAttempt.ok && lowerAttempt.status === 409, "Tahsilat yapılmış siparişin tutarı düşürülemiyor (SP-08)");

  // 10) Durum ilerletme: onaylandı → hazırlanıyor → teslim edildi → tamamlandı
  const adv1 = await advanceOrderStatus(session, orderId);
  assert(adv1.ok && adv1.data.status === "PREPARING", "Sipariş hazırlanıyor durumuna geçti");
  const adv2 = await advanceOrderStatus(session, orderId);
  assert(adv2.ok && adv2.data.status === "DELIVERED", "Sipariş teslim edildi durumuna geçti");
  const adv3 = await advanceOrderStatus(session, orderId);
  assert(adv3.ok && adv3.data.status === "COMPLETED", "Sipariş tamamlandı durumuna geçti");
  const adv4 = await advanceOrderStatus(session, orderId);
  assert(!adv4.ok, "Tamamlanmış siparişten ileri gidilemiyor");

  // 11) Tamamlanmış sipariş iptal edilemez
  const cancelCompleted = await cancelOrder(session, orderId, "test");
  assert(!cancelCompleted.ok && cancelCompleted.status === 409, "Tamamlanmış sipariş iptal edilemiyor");

  // 12) İkinci bir sipariş üzerinde iptal akışını test et (SP-04/SP-05)
  const secondOrderQuote = await createQuote(session, { ...quoteInput, items: [quoteInput.items[0]] });
  if (secondOrderQuote.ok) {
    await sendQuote(session, secondOrderQuote.data.id);
    await acceptQuote(session, secondOrderQuote.data.id);
    const secondOrder = await createOrderFromQuote(session, secondOrderQuote.data.id);
    if (secondOrder.ok) {
      const cancelResult = await cancelOrder(session, secondOrder.data.id, "Müşteri vazgeçti");
      assert(cancelResult.ok, "Onaylandı durumundaki sipariş iptal edilebiliyor");
      const cancelledOrder = await getOrder(session, secondOrder.data.id);
      assert(cancelledOrder.ok && cancelledOrder.data.status === "CANCELLED", "İptal durumu kalıcı");
    }
  }

  // 13) Red senaryosu — ayrı bir teklif üzerinden
  const rejectQuoteInput = await createQuote(session, { ...quoteInput, items: [quoteInput.items[1]] });
  if (rejectQuoteInput.ok) {
    await sendQuote(session, rejectQuoteInput.data.id);
    const rejected = await rejectQuote(session, rejectQuoteInput.data.id);
    assert(rejected.ok && rejected.data.status === "REJECTED", "Teklif reddedildi");
  }

  // 14) TH-06 İade — gerekçesiz reddedilir, gerekçeli kabul edilir
  const { paymentInputSchema } = await import("../src/lib/validation/payment");
  const refundNoReason = paymentInputSchema.safeParse({
    customerId: customer.id,
    accountId: DEMO_ACCOUNT_ID,
    paidAt: new Date(),
    amount: -100,
    method: "CASH",
    allocations: [],
  });
  assert(!refundNoReason.success, "Gerekçesiz iade zod şemasında reddediliyor");

  const refundResult = await createPayment(session, {
    customerId: customer.id,
    accountId: DEMO_ACCOUNT_ID,
    paidAt: new Date(),
    amount: -50,
    method: "CASH",
    reference: "",
    note: "Fazla ödeme iadesi",
    allocations: [],
  });
  assert(refundResult.ok, "Gerekçeli iade kaydı oluşturuldu");

  // 15) TH-08 — tahsilat iptali
  if (partialPayment.ok) {
    const cancelPay = await cancelPayment(session, partialPayment.data.id, "Yanlış girildi");
    assert(cancelPay.ok, "Tahsilat iptal edildi (silinmedi)");
  }

  // 16) TH-07 — vadesi geçmiş alacaklar (geçmiş tarihli bir ödeme planı ile)
  const overdueQuote = await createQuote(session, { ...quoteInput, items: [quoteInput.items[0]] });
  if (overdueQuote.ok) {
    await sendQuote(session, overdueQuote.data.id);
    await acceptQuote(session, overdueQuote.data.id);
    const overdueOrder = await createOrderFromQuote(session, overdueQuote.data.id);
    if (overdueOrder.ok) {
      await withPlatformBypass((tx) =>
        tx.paymentSchedule.create({
          data: { orderId: overdueOrder.data.id, dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), amount: 100 },
        }),
      );
      const overdueList = await listOverdueReceivables(session);
      assert(
        overdueList.ok && overdueList.data.some((r) => r.orderId === overdueOrder.data.id),
        "Vadesi geçmiş alacak listede görünüyor",
      );
    }
  }

  // Temizlik
  await withPlatformBypass(async (tx) => {
    await tx.paymentAllocation.deleteMany({ where: { order: { customerId: customer.id } } });
    await tx.paymentSchedule.deleteMany({ where: { order: { customerId: customer.id } } });
    await tx.payment.deleteMany({ where: { customerId: customer.id } });
    await tx.orderItem.deleteMany({ where: { order: { customerId: customer.id } } });
    await tx.order.deleteMany({ where: { customerId: customer.id } });
    await tx.quoteItem.deleteMany({ where: { quote: { customerId: customer.id } } });
    await tx.quote.deleteMany({ where: { customerId: customer.id } });
    await tx.customer.delete({ where: { id: customer.id } });
  });
  console.log("· test verisi temizlendi");

  report();
}

function report() {
  console.log(failures === 0 ? "\n🎉 Satış akışı (Teklif→Sipariş→Tahsilat) tüm kontrollerden geçti." : `\n${failures} kontrol BAŞARISIZ.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
