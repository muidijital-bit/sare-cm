// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Teklif Şablonları uçtan uca doğrulaması — YALNIZCA geliştirme veritabanında (canlıda çalışmaz).
 * Yetki, hesap motoru (örnek Excel'in TAŞMALI sayfası değerleriyle), şablondan teklif hazırlama,
 * satış "own" kapsamı, satış teklifine dönüştürme (+ ikinci kez engeli), müşteri Excel'inde maliyet
 * sızmaması, RLS. Test verisi sonda silinir.
 */
import { randomUUID } from "crypto";
import ExcelJS from "exceljs";
import { withPlatformBypass, withTenant } from "../src/lib/db/tenant-context";
import { createWorkbook, getWorkbook, listWorkbooks, prepareQuoteFromTemplate, convertToSalesQuote, deleteWorkbook, canManageTemplates } from "../src/lib/modules/quote-templates/service";
import { sheetTotals } from "../src/lib/modules/quote-templates/calc";
import { buildWorkbookXlsx } from "../src/lib/modules/quote-templates/export";
import { workbookContentSchema } from "../src/lib/modules/quote-templates/types";
import type { TenantSession } from "../src/lib/auth/session";

let failures = 0;
const check = (label: string, cond: boolean) => (cond ? console.log(`✅ ${label}`) : (console.error(`❌ ${label}`), failures++));
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

async function main() {
  const host = new URL(process.env.APP_DATABASE_URL!).hostname;
  if (process.env.PROD_APP_DATABASE_URL && host === new URL(process.env.PROD_APP_DATABASE_URL).hostname) throw new Error("Canlı veritabanında çalıştırılamaz.");

  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const company = await withPlatformBypass((tx) => tx.company.findFirstOrThrow({ where: { name: "Sare Havuz & Spa", deletedAt: null } }));
  const base: TenantSession = { userId: owner.id, userName: owner.name, userEmail: owner.email, companyId: company.id, companyName: company.name, companyStatus: "ACTIVE", role: "OWNER", enabledModules: ["*"], membershipCount: 1 };
  const sales: TenantSession = { ...base, userId: randomUUID(), role: "SALES" };
  const viewer: TenantSession = { ...base, role: "VIEWER" };

  check("yetki: OWNER şablon yönetir", canManageTemplates(base));
  check("yetki: SALES şablon yönetemez", !canManageTemplates(sales));

  // Örnek Excel TAŞMALI sayfasının özeti: 1803,3 € malzeme, kur 54, işçilik 50.000, kâr 1,35, genel gider 25.000 → 223.960,57 ₺
  const content = workbookContentSchema.parse({
    branding: { companyTitle: "TEST HAVUZ LTD", phone: "0 312 000 00 00", email: "test@example.com" },
    cover: { greeting: "Sayın {musteri},", intro: "Teklifimizi sunarız.", notes: ["KDV hariçtir."] },
    sheets: [
      {
        name: "TAŞMALI",
        title: "TAŞMALI YÜZME HAVUZU",
        specs: [{ label: "EN", value: "4" }],
        pricing: { currency: "EUR", exchangeRate: 54, laborCost: 50000, profitMultiplier: 1.35, overheadCost: 25000 },
        groups: [{ title: "1-MALZEME", items: [{ description: "KUM FİLTRESİ", quantity: 1, unit: "AD", listPrice: 385, netPrice: 1803.3, notes: ["Çap 600"] }] }],
        summaryLabel: "ELEKTRO-MEKANİK İŞLERİ",
      },
      { name: "SERAMİK", title: "SERAMİK", pricing: { currency: "TRY", discountPct: 50 }, groups: [{ title: "", items: [{ description: "KARO", quantity: 10, unit: "M²", listPrice: 1000 }] }] },
      { name: "KALIP HESAP", title: "İç hesap", includeInSummary: false, groups: [{ title: "", items: [{ description: "BETON", quantity: 1, unit: "", netPrice: 999 }] }] },
    ],
  });
  check(`hesap: TAŞMALI satış = 223.960,57 (${sheetTotals(content.sheets[0]).total.toFixed(2)})`, near(sheetTotals(content.sheets[0]).total, 223960.57));
  check(`hesap: iskonto %50 → SERAMİK 5.000 (${sheetTotals(content.sheets[1]).total})`, near(sheetTotals(content.sheets[1]).total, 5000));

  const tag = randomUUID().slice(0, 6);
  const ids = { template: "", doc: "", salesDoc: "", quote: "", customer: "", otherCustomer: "" };
  try {
    const [cust] = await withTenant(company.id, async (tx) => [
      await tx.customer.create({ data: { companyId: company.id, title: `__Şablon Test ${tag}`, type: "INDIVIDUAL", address: "Test Mah. Ankara", ownerUserId: owner.id, createdBy: owner.id } }),
    ]);
    ids.customer = cust.id;
    await withTenant(company.id, (tx) => tx.contact.create({ data: { companyId: company.id, customerId: cust.id, name: "Ali Test", phone: "0555 111 22 33", email: "ali@example.com", isPrimary: true } }));

    const denied = await createWorkbook(sales, "TEMPLATE", { name: "x", content });
    check("SALES şablon oluşturamaz → 403", !denied.ok && denied.status === 403);
    const deniedV = await createWorkbook(viewer, "QUOTE", { name: "x", content });
    check("VIEWER teklif hazırlayamaz → 403", !deniedV.ok && deniedV.status === 403);

    const t = await createWorkbook(base, "TEMPLATE", { name: `__Test şablon ${tag}`, content });
    check("şablon oluşturuldu", t.ok);
    if (!t.ok) return;
    ids.template = t.data.id;
    const listed = await listWorkbooks(base, "TEMPLATE");
    check("şablon listede, toplam = 223.960,57 + 5.000", listed.ok && listed.data.some((r) => r.id === ids.template && near(r.total, 228960.57)));

    // Şablondan teklif hazırla — yalnızca TAŞMALI + SERAMİK
    const prep = await prepareQuoteFromTemplate(base, ids.template, { customerId: cust.id, sheetNames: ["TAŞMALI", "SERAMİK"] });
    check("şablondan teklif hazırlandı", prep.ok);
    if (!prep.ok) return;
    ids.doc = prep.data.id;
    const doc = await getWorkbook(base, ids.doc);
    check("belge: seçilen 2 sayfa kopyalandı", doc.ok && doc.data.content.sheets.length === 2);
    check("belge: müşteri adı/adres/telefon/e-posta doldu", doc.ok && doc.data.content.customer.name === cust.title && doc.data.content.customer.address === "Test Mah. Ankara" && doc.data.content.customer.phone === "0555 111 22 33" && doc.data.content.customer.email === "ali@example.com");
    check("belge: kaynak şablon kaydedildi", doc.ok && doc.data.sourceTemplateId === ids.template);

    // SALES kendi belgesini hazırlar, başkasınınkini göremez
    const salesPrep = await prepareQuoteFromTemplate(sales, ids.template, { customerId: cust.id });
    check("SALES şablondan teklif hazırlayabilir", salesPrep.ok);
    if (salesPrep.ok) ids.salesDoc = salesPrep.data.id;
    const salesSeesOwner = await getWorkbook(sales, ids.doc);
    check("SALES başkasının teklif belgesini göremez → 403", !salesSeesOwner.ok && salesSeesOwner.status === 403);
    const salesList = await listWorkbooks(sales, "QUOTE");
    check("SALES listesinde yalnız kendi belgesi", salesList.ok && salesList.data.every((r) => r.id !== ids.doc));

    // Excel: müşteri sürümünde maliyet yok, iç sürümde var
    if (doc.ok) {
      const read = async (mode: "customer" | "internal") => {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load((await buildWorkbookXlsx(doc.data.content, mode)) as unknown as ArrayBuffer);
        const texts: string[] = [];
        wb.eachSheet((ws) => ws.eachRow((r) => (r.values as unknown[]).forEach((v) => v != null && texts.push(typeof v === "object" ? JSON.stringify(v) : String(v)))));
        return { names: wb.worksheets.map((w) => w.name), text: texts.join(" | ") };
      };
      const cu = await read("customer");
      const inn = await read("internal");
      check(`müşteri Excel: kapak + 2 sayfa (${cu.names.join(", ")})`, cu.names.length === 3 && cu.names[0] === "BAŞLIK");
      check("müşteri Excel: NET ALIŞ / maliyet / kâr çarpanı YOK", !/NET ALIŞ|MALİYET|Kâr çarpanı|1803/.test(cu.text));
      check("müşteri Excel: hitap müşteri adıyla", cu.text.includes(`Sayın ${cust.title},`));
      check("iç Excel: NET ALIŞ ve kâr çarpanı VAR", /NET ALIŞ/.test(inn.text) && /Kâr çarpanı/.test(inn.text));
    }

    // Satış teklifine dönüştür
    const conv = await convertToSalesQuote(base, ids.doc);
    check("satış teklifine dönüştürüldü", conv.ok);
    if (conv.ok) {
      ids.quote = conv.data.quoteId;
      const q = await withTenant(company.id, (tx) => tx.quote.findUniqueOrThrow({ where: { id: conv.data.quoteId }, include: { items: { orderBy: { sortOrder: "asc" } } } }));
      check(`teklif: 2 satır (${q.items.length})`, q.items.length === 2);
      check(`teklif: 1. satır fiyat 223.960,57 (${q.items[0]?.unitPrice})`, near(Number(q.items[0]?.unitPrice), 223960.57));
      check(`teklif: 1. satır maliyet = maliyet + genel gider (147.378,2 + 25.000) (${q.items[0]?.unitCost})`, near(Number(q.items[0]?.unitCost), 172378.2));
      check(`teklif: satır adı icmal etiketi`, q.items[0]?.description === "ELEKTRO-MEKANİK İŞLERİ");
      const after = await getWorkbook(base, ids.doc);
      check("belgeye teklif no yazıldı", after.ok && after.data.content.customer.quoteNo === q.number && after.data.convertedQuoteId === q.id);
      const again = await convertToSalesQuote(base, ids.doc);
      check("ikinci kez dönüştürme → engellendi", !again.ok);
    }

    // RLS
    const other = await withPlatformBypass((tx) => tx.company.findFirst({ where: { id: { not: company.id }, deletedAt: null } }));
    if (other) {
      const seen = await withTenant(other.id, (tx) => tx.quoteWorkbook.count({ where: { id: ids.template } }));
      check("RLS: başka şirket şablonu göremez", seen === 0);
      let blocked = false;
      try {
        await withTenant(other.id, (tx) => tx.quoteWorkbook.create({ data: { companyId: company.id, kind: "TEMPLATE", name: "sızma", content: {}, ownerUserId: owner.id, createdBy: owner.id } }));
      } catch {
        blocked = true;
      }
      check("RLS: başka şirket adına yazılamaz", blocked);
    }

    const del = await deleteWorkbook(sales, ids.template);
    check("SALES şablon silemez → 403", !del.ok && del.status === 403);
  } finally {
    await withPlatformBypass(async (tx) => {
      if (ids.quote) {
        await tx.quoteItem.deleteMany({ where: { quoteId: ids.quote } });
        await tx.quote.deleteMany({ where: { id: ids.quote } });
      }
      const wbIds = [ids.template, ids.doc, ids.salesDoc].filter(Boolean);
      await tx.quoteWorkbook.deleteMany({ where: { id: { in: wbIds } } });
      if (ids.customer) {
        await tx.contact.deleteMany({ where: { customerId: ids.customer } });
        await tx.customer.deleteMany({ where: { id: ids.customer } });
      }
      await tx.auditLog.deleteMany({ where: { entityId: { in: [...wbIds, ids.quote].filter(Boolean) } } });
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
