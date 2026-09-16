import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;
type DecimalInput = Prisma.Decimal.Value;

/**
 * Teklif/Sipariş satır ve belge toplamı hesaplamaları (TK-04). `Prisma.Decimal` kullanılır
 * — JS `number` ile para hesabı yapılmaz (bkz. .claude/agents/api-backend-dev.md).
 *
 * Hesap sırası (dokümandaki TK-04 sırasıyla): satır toplamı → ara toplam (iskontosuz brüt)
 * → iskonto toplamı (satır + belge geneli) → KDV toplamı → genel toplam.
 *
 * Bilinçli basitleştirme: belge geneline uygulanan iskonto (TK-05) yalnızca nihai tutarı
 * düşürür, KDV satır bazında (belge iskontosu uygulanmadan) hesaplanır. Gerçek muhasebe
 * pratiğinde belge iskontosunun KDV matrahını da etkilemesi beklenebilir; V1 kapsamında
 * bu ayrım netleştirilmediği için basit taraf seçildi — ileride değişirse yalnızca bu
 * dosya güncellenir.
 */

export type DiscountType = "PERCENT" | "AMOUNT";

export interface LineInput {
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  discountType: DiscountType;
  discountValue: DecimalInput;
  vatRate: DecimalInput;
}

export interface LineCalculated {
  lineGross: Prisma.Decimal; // miktar × birim fiyat (iskontosuz)
  lineDiscountAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal; // lineGross - lineDiscountAmount (KDV hariç, net) — DB'ye yazılan alan
  lineVat: Prisma.Decimal;
}

export interface DocumentDiscount {
  type: DiscountType;
  value: DecimalInput;
}

export interface DocumentTotals {
  subtotal: Prisma.Decimal; // Σ lineGross (iskontosuz brüt) — TK-04 "ara toplam"
  lineDiscountTotal: Prisma.Decimal;
  documentDiscountAmount: Prisma.Decimal;
  discountTotal: Prisma.Decimal; // lineDiscountTotal + documentDiscountAmount
  netTotal: Prisma.Decimal; // subtotal - discountTotal (KDV hariç)
  vatTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal; // netTotal + vatTotal (KDV dahil)
}

function round2(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2);
}

export function calculateLine(line: LineInput): LineCalculated {
  const quantity = new Decimal(line.quantity);
  const unitPrice = new Decimal(line.unitPrice);
  const discountValue = new Decimal(line.discountValue);
  const vatRate = new Decimal(line.vatRate);

  const lineGross = round2(quantity.mul(unitPrice));
  const lineDiscountAmount = round2(
    line.discountType === "PERCENT" ? lineGross.mul(discountValue).div(100) : discountValue,
  );
  const lineTotal = round2(lineGross.sub(lineDiscountAmount));
  const lineVat = round2(lineTotal.mul(vatRate).div(100));

  return { lineGross, lineDiscountAmount, lineTotal, lineVat };
}

export function calculateDocument(
  lines: LineInput[],
  documentDiscount?: DocumentDiscount | null,
): { lines: LineCalculated[]; totals: DocumentTotals } {
  const calculatedLines = lines.map(calculateLine);

  const subtotal = calculatedLines.reduce((sum, l) => sum.add(l.lineGross), new Decimal(0));
  const lineDiscountTotal = calculatedLines.reduce((sum, l) => sum.add(l.lineDiscountAmount), new Decimal(0));
  const netBeforeDocDiscount = subtotal.sub(lineDiscountTotal);

  let documentDiscountAmount = new Decimal(0);
  if (documentDiscount) {
    const value = new Decimal(documentDiscount.value);
    documentDiscountAmount = round2(
      documentDiscount.type === "PERCENT" ? netBeforeDocDiscount.mul(value).div(100) : value,
    );
  }

  const discountTotal = round2(lineDiscountTotal.add(documentDiscountAmount));
  const netTotal = round2(subtotal.sub(discountTotal));
  const vatTotal = round2(calculatedLines.reduce((sum, l) => sum.add(l.lineVat), new Decimal(0)));
  const grandTotal = round2(netTotal.add(vatTotal));

  return {
    lines: calculatedLines,
    totals: { subtotal: round2(subtotal), lineDiscountTotal: round2(lineDiscountTotal), documentDiscountAmount, discountTotal, netTotal, vatTotal, grandTotal },
  };
}
