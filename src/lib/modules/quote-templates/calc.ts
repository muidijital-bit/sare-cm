import type { TemplateItem, TemplateSheet, WorkbookContent } from "./types";

/**
 * Şablon sayfası fiyat hesabı — örnek Excel'deki (TAŞMALI vb.) mantığın birebir karşılığı:
 *
 *   net alış        = net fiyat  (yoksa liste × (1 − iskonto%))
 *   malzeme (döviz) = Σ miktar × net alış
 *   malzeme (TL)    = malzeme × kur
 *   maliyet         = malzeme (TL) + işçilik + ekstra gider
 *   SATIŞ TOPLAMI   = maliyet × kâr çarpanı + genel gider
 *
 * "Liste fiyatından" satılan gruplar (örn. seramik) kâr çarpanının dışındadır:
 *   SATIŞ = (maliyet − liste gruplarının maliyeti) × kâr çarpanı + Σ liste × (1 − grup iskontosu%) + genel gider
 *
 * (Doğrulama: örnek dosyada 1803,3 € × 54 + 50.000 = 147.378,2 → × 1,35 + 25.000 = 223.960,57 ₺.)
 */
export function itemNet(item: TemplateItem, discountPct: number): number | null {
  if (item.netPrice != null) return item.netPrice;
  if (item.listPrice != null) return item.listPrice * (1 - (discountPct || 0) / 100);
  return null;
}

export function itemLineCost(item: TemplateItem, discountPct: number): number {
  if (item.isHeading || item.quantity == null) return 0;
  const net = itemNet(item, discountPct);
  return net == null ? 0 : item.quantity * net;
}

export interface SheetTotals {
  materials: number; // sayfa para biriminde
  materialsTRY: number;
  cost: number; // TL
  total: number; // TL — müşteriye verilen
  profit: number; // TL
  itemCount: number;
}

export function sheetTotals(sheet: TemplateSheet): SheetTotals {
  const p = sheet.pricing;
  const rate = p.currency === "TRY" ? 1 : p.exchangeRate || 0;
  let materials = 0;
  let listMaterials = 0; // liste fiyatından satılan grupların maliyeti
  let listSale = 0; // ve satış tutarı (sayfa para biriminde)
  let itemCount = 0;
  for (const g of sheet.groups) {
    for (const it of g.items) {
      const line = itemLineCost(it, p.discountPct);
      materials += line;
      if (g.saleBasis === "list") {
        listMaterials += line;
        if (!it.isHeading && it.quantity != null) listSale += it.quantity * (it.listPrice ?? itemNet(it, p.discountPct) ?? 0) * (1 - (g.listDiscountPct || 0) / 100);
      }
      if (!it.isHeading && it.quantity != null) itemCount++;
    }
  }
  const materialsTRY = materials * rate;
  const cost = materialsTRY + (p.laborCost || 0) + (p.extraCost || 0);
  const total = (cost - listMaterials * rate) * (p.profitMultiplier || 1) + listSale * rate + (p.overheadCost || 0);
  return { materials, materialsTRY, cost, total, profit: total - cost - (p.overheadCost || 0), itemCount };
}

export function workbookTotal(content: WorkbookContent): number {
  return content.sheets.filter((s) => s.includeInSummary).reduce((sum, s) => sum + sheetTotals(s).total, 0);
}
