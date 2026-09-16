/**
 * İstemci tarafı ÖNİZLEME hesaplaması — düz JS `number` kullanır, yalnızca kullanıcıya
 * anlık toplam göstermek içindir. Yetkili/kalıcı hesap her zaman sunucuda
 * `src/lib/modules/documents/calculations.ts` (Decimal) ile yeniden yapılır; buradaki
 * yuvarlama farkları kalıcı veriyi ETKİLEMEZ.
 */
export interface PreviewLine {
  quantity: number;
  unitPrice: number;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: number;
  vatRate: number;
}

export interface PreviewTotals {
  subtotal: number;
  discountTotal: number;
  netTotal: number;
  vatTotal: number;
  grandTotal: number;
}

export function previewLineTotal(line: PreviewLine): number {
  const gross = line.quantity * line.unitPrice;
  const discount = line.discountType === "PERCENT" ? (gross * line.discountValue) / 100 : line.discountValue;
  return Math.max(0, gross - discount);
}

export function previewDocumentTotals(
  lines: PreviewLine[],
  documentDiscount?: { type: "PERCENT" | "AMOUNT"; value: number } | null,
): PreviewTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const lineDiscountTotal = lines.reduce((sum, l) => {
    const gross = l.quantity * l.unitPrice;
    return sum + (l.discountType === "PERCENT" ? (gross * l.discountValue) / 100 : l.discountValue);
  }, 0);
  const netBeforeDoc = subtotal - lineDiscountTotal;

  let documentDiscountAmount = 0;
  if (documentDiscount && documentDiscount.value > 0) {
    documentDiscountAmount = documentDiscount.type === "PERCENT" ? (netBeforeDoc * documentDiscount.value) / 100 : documentDiscount.value;
  }

  const discountTotal = lineDiscountTotal + documentDiscountAmount;
  const netTotal = Math.max(0, subtotal - discountTotal);
  const vatTotal = lines.reduce((sum, l) => sum + previewLineTotal(l) * (l.vatRate / 100), 0);
  const grandTotal = netTotal + vatTotal;

  return { subtotal, discountTotal, netTotal, vatTotal, grandTotal };
}
