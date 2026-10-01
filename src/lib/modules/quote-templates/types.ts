import { z } from "zod";

/**
 * Teklif şablonu / şablondan hazırlanan teklif belgesi — çok sayfalı (Excel'deki sheet'ler gibi)
 * içerik modeli. Veritabanında `quote_workbooks.content` JSON alanında saklanır; şema buradadır
 * (hem doğrulama hem tip). Fiyat hesabı calc.ts, Excel içe aktarma parse.ts, dışa aktarma export.ts.
 */

const str = (max: number) => z.string().max(max).default("");
const num = z.coerce.number().finite();

export const itemSchema = z.object({
  /** Boyut/marka gibi ön sütun (örn. "12,5 X 25", "KYK MEGA FLEX"). */
  prefix: str(120),
  description: z.string().max(2000).default(""),
  /** Kalemin altındaki "*" açıklama satırları. */
  notes: z.array(z.string().max(4000)).max(40).default([]),
  /** Miktarı olmayan ara başlık (örn. "TEMİZLİK SETİ"). */
  isHeading: z.boolean().default(false),
  quantity: num.nullable().default(null),
  unit: str(30),
  /** Liste fiyatı (sayfa para biriminde). */
  listPrice: num.nullable().default(null),
  /** Net alış (maliyet). Boşsa liste fiyatı × (1 − iskonto) kullanılır. */
  netPrice: num.nullable().default(null),
});
export type TemplateItem = z.infer<typeof itemSchema>;

export const groupSchema = z.object({
  title: str(300),
  items: z.array(itemSchema).max(400).default([]),
});
export type TemplateGroup = z.infer<typeof groupSchema>;

export const CURRENCIES = ["TRY", "EUR", "USD"] as const;

export const sheetSchema = z.object({
  /** Excel sekme adı (≤31 karakter). */
  name: z.string().trim().min(1).max(31),
  title: str(300),
  specs: z.array(z.object({ label: str(300), value: str(2000) })).max(80).default([]),
  groups: z.array(groupSchema).max(60).default([]),
  /** Tablo dışı açıklamalar (dahil olanlar, müşterinin yapması gerekenler vb.). */
  footnotes: z.array(z.string().max(6000)).max(80).default([]),
  pricing: z
    .object({
      currency: z.enum(CURRENCIES).default("TRY"),
      /** Sayfa para birimi → TL kuru (TRY ise 1). */
      exchangeRate: num.default(1),
      /** Liste fiyatından net alışa varsayılan iskonto (%). */
      discountPct: num.default(0),
      /** TL — kâr çarpanından ÖNCE eklenir. */
      laborCost: num.default(0),
      extraCost: num.default(0),
      /** Maliyet × kâr çarpanı (örn. 1,35). */
      profitMultiplier: num.default(1),
      /** TL — kârdan SONRA eklenen genel gider. */
      overheadCost: num.default(0),
    })
    .default({}),
  /** Kapak sayfasındaki "Genel İcmal"de yer alsın mı ve hangi etiketle. */
  includeInSummary: z.boolean().default(true),
  summaryLabel: str(200),
});
export type TemplateSheet = z.infer<typeof sheetSchema>;

export const brandingSchema = z.object({
  /** data:image/png;base64,… (≤ ~400 KB). */
  logoDataUrl: z.string().max(600_000).default(""),
  companyTitle: str(300),
  address: str(500),
  phone: str(60),
  gsm: str(60),
  email: str(120),
  web: str(120),
  taxInfo: str(200),
});
export type TemplateBranding = z.infer<typeof brandingSchema>;

export const coverSchema = z.object({
  /** "{musteri}" yer tutucusu müşteri adıyla değiştirilir. */
  greeting: str(300),
  intro: str(8000),
  closing: str(300),
  signatureName: str(120),
  signatureTitle: str(200),
  notes: z.array(z.string().max(2000)).max(40).default([]),
  vatNote: str(300),
});
export type TemplateCover = z.infer<typeof coverSchema>;

export const customerInfoSchema = z.object({
  /** Teklif no (satış teklifine dönüştürülünce o teklifin numarası yazılır) ve tarih (gg.aa.yyyy). */
  quoteNo: str(60),
  date: str(30),
  name: str(300),
  address: str(500),
  phone: str(60),
  email: str(120),
});
export type CustomerInfo = z.infer<typeof customerInfoSchema>;

export const workbookContentSchema = z.object({
  branding: brandingSchema.default({}),
  cover: coverSchema.default({}),
  sheets: z.array(sheetSchema).max(30).default([]),
  customer: customerInfoSchema.default({}),
});
export type WorkbookContent = z.infer<typeof workbookContentSchema>;

export const workbookInputSchema = z.object({
  name: z.string().trim().min(1, "Ad zorunlu").max(200),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  customerId: z.preprocess((v) => (v === "" ? null : v), z.string().uuid().nullable().optional()),
  content: workbookContentSchema,
});
export type WorkbookInput = z.infer<typeof workbookInputSchema>;

export function emptyContent(): WorkbookContent {
  return workbookContentSchema.parse({});
}

export function emptySheet(name = "Sayfa 1"): TemplateSheet {
  return sheetSchema.parse({ name, groups: [{ title: "", items: [] }] });
}
