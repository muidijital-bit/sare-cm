import { Prisma, type StockMovementType } from "@prisma/client";

const { Decimal } = Prisma;

/**
 * SM-03: stok defteri yardımcıları. Tek gerçek kaynak `stock_movements`'tır —
 * `Product.stockQty` her zaman bu tablodaki (işaretli) miktarların toplamına eşit tutulur;
 * `applyStockDeltas` bu ikisini AYNI transaction içinde, atomik olarak günceller.
 *
 * Sipariş tarafı (createOrder/updateOrder/cancelOrder) "mutlak hedef" mantığıyla çalışır:
 * her çağrıda "bu sipariş şu an ürün başına ne kadar rezerve etmeli" hesaplanır, mevcut net
 * rezervasyonla farkı alınır ve yalnızca fark kadar yeni bir hareket yazılır. Bu, siparişin
 * kaç kez düzenlendiğinden BAĞIMSIZ olarak stoğun her zaman doğru olmasını sağlar (delta
 * biriktirmek yerine hedefe göre yeniden hesaplama — çift sayım riski yok).
 */
export async function applyStockDeltas(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    deltas: { productId: string; delta: Prisma.Decimal }[];
    type: StockMovementType;
    createdBy: string;
    orderId?: string;
    purchaseOrderId?: string;
    projectMaterialId?: string;
    note?: string;
  },
): Promise<void> {
  for (const d of params.deltas) {
    if (d.delta.isZero()) continue;
    await tx.stockMovement.create({
      data: {
        companyId: params.companyId,
        productId: d.productId,
        type: params.type,
        quantity: d.delta,
        orderId: params.orderId,
        purchaseOrderId: params.purchaseOrderId,
        projectMaterialId: params.projectMaterialId,
        note: params.note,
        createdBy: params.createdBy,
      },
    });
    await tx.product.update({ where: { id: d.productId }, data: { stockQty: { increment: d.delta } } });
  }
}

/** Bir siparişe ait tüm stok hareketlerinin ürün başına net (işaretli) toplamı. */
async function getOrderNetStockByProduct(tx: Prisma.TransactionClient, orderId: string): Promise<Map<string, Prisma.Decimal>> {
  const rows = await tx.stockMovement.groupBy({ by: ["productId"], where: { orderId }, _sum: { quantity: true } });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? new Decimal(0)]));
}

/** Sipariş satırlarından "olması gereken" net rezervasyonu (ürün başına, negatif) hesaplar. Ürünsüz (serbest metin) satırlar stoğu etkilemez. */
function requiredReservationByProduct(items: { productId: string | null; quantity: Prisma.Decimal.Value }[]): Map<string, Prisma.Decimal> {
  const m = new Map<string, Prisma.Decimal>();
  for (const it of items) {
    if (!it.productId) continue;
    const delta = new Decimal(it.quantity).negated();
    m.set(it.productId, (m.get(it.productId) ?? new Decimal(0)).plus(delta));
  }
  return m;
}

/** Sipariş oluşturma/düzenleme sonrası çağrılır — stoğu satırlarla eşleşecek şekilde günceller. */
export async function reconcileOrderStock(
  tx: Prisma.TransactionClient,
  companyId: string,
  orderId: string,
  items: { productId: string | null; quantity: Prisma.Decimal.Value }[],
  createdBy: string,
): Promise<void> {
  const required = requiredReservationByProduct(items);
  const current = await getOrderNetStockByProduct(tx, orderId);
  const productIds = new Set(Array.from(required.keys()).concat(Array.from(current.keys())));
  const deltas = Array.from(productIds).map((productId) => ({
    productId,
    delta: (required.get(productId) ?? new Decimal(0)).minus(current.get(productId) ?? new Decimal(0)),
  }));
  await applyStockDeltas(tx, { companyId, deltas, type: "ORDER_RESERVED", createdBy, orderId });
}

/** Sipariş iptalinde çağrılır — o siparişin şimdiye kadarki TÜM net rezervasyonunu tersine çevirir. */
export async function reverseOrderStock(tx: Prisma.TransactionClient, companyId: string, orderId: string, createdBy: string): Promise<void> {
  const current = await getOrderNetStockByProduct(tx, orderId);
  const deltas = Array.from(current.entries()).map(([productId, net]) => ({ productId, delta: net.negated() }));
  await applyStockDeltas(tx, { companyId, deltas, type: "ORDER_CANCELLED", createdBy, orderId });
}
