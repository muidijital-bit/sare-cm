// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Bir firmanın mevcut Excel teklif dosyasından (çok sayfalı .xls/.xlsx) ürün bazlı teklif şablonları
 * oluşturur: her ürün (Taşmalı havuz, Skimmerli havuz, Panel havuz, Sauna, Buhar odası, Hamam,
 * Tuz odası) ayrı şablon + tüm sayfaları içeren "Komple" şablon. Antet, kapak yazısı, notlar ve
 * logo her şablona aynı şekilde konur.
 *
 * Excel'deki ürün sayfaları içe aktarıcıyla (parse.ts) okunur. Sauna / Buhar odası / Hamam / Tuz
 * odası sayfaları Excel'de "hesap makinesi + seçenek tablosu" düzenindedir; bunlar müşteriye
 * gidecek şekilde elle düzenlenir (fiyatlar Excel'deki değerlerle aynıdır).
 *
 *   npx tsx scripts/seed-quote-templates.ts --company "Sare Havuz" --file "<xls>" --logo "<png/jpg>" [--replace]
 *
 * Aynı adlı şablon varsa atlanır; --replace ile eskisi silinip yeniden oluşturulur. Canlıda çalıştırmak
 * için APP_DATABASE_URL canlıya çevrilmelidir (hedef sunucu en başta yazdırılır).
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { withPlatformBypass, withTenant } from "../src/lib/db/tenant-context";
import { createWorkbook } from "../src/lib/modules/quote-templates/service";
import { parseWorkbook, type RawSheet } from "../src/lib/modules/quote-templates/parse";
import { sheetTotals } from "../src/lib/modules/quote-templates/calc";
import { sheetSchema, workbookContentSchema, type TemplateItem, type TemplateSheet, type WorkbookContent } from "../src/lib/modules/quote-templates/types";
import type { TenantSession } from "../src/lib/auth/session";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const item = (description: string, quantity: number, netPrice: number, unit = "ADET", notes: string[] = []): TemplateItem => ({
  prefix: "",
  description,
  notes,
  isHeading: false,
  quantity,
  unit,
  listPrice: null,
  netPrice,
});

/** Sauna — Excel: iki seçenek (maliyet 55.000 / 65.000 × 1,3). Varsayılan Seçim 1; diğerinin miktarı 0. */
function saunaSheet(parsed: TemplateSheet): TemplateSheet {
  return sheetSchema.parse({
    name: "SAUNA",
    title: "SAUNA FİYAT TEKLİFİ",
    specs: [
      { label: "Ölçüler (En × Boy × h)", value: "2 m × 2,5 m × 2,1 m" },
      { label: "Soba", value: "Yerli marka, 7,5 kW/sa ~ 380 V, harici kumandalı" },
      { label: "Belge", value: "Türk malıdır, CE belgelidir" },
    ],
    groups: [
      {
        title: "SAUNA İMALATI (yerli marka soba ile)",
        items: [
          item("Seçim 1 — Duvarlar: ÇAM, Oturak ve paspaslar: AYOUS", 1, 55000, "TAKIM", ["Sauna 45.000 + soba 10.000"]),
          item("Seçim 2 — Duvarlar: AYOUS, Oturak ve paspaslar: AYOUS", 0, 65000, "TAKIM", ["Sauna 55.000 + soba 10.000"]),
        ],
      },
    ],
    footnotes: [
      "Fiyatlara dâhil olan yapım ve aksesuarlar:",
      ...parsed.footnotes,
      "Seçim 2 için miktarını 1, Seçim 1'in miktarını 0 yapın (miktarı 0 olan kalem müşteri Excel'inde görünmez).",
    ],
    pricing: { currency: "TRY", exchangeRate: 1, discountPct: 0, laborCost: 0, extraCost: 0, profitMultiplier: 1.3, overheadCost: 0 },
  });
}

/** Tuz odası — Excel: üç tuz seçeneği + opsiyonel jeneratör (maliyet × 1,3). */
function tuzSheet(parsed: TemplateSheet): TemplateSheet {
  return sheetSchema.parse({
    name: "TUZ ODASI",
    title: "TUZ ODASI FİYAT TEKLİFİ",
    specs: [{ label: "Ölçüler", value: "250 × 500 cm tuz odası imalatı" }],
    groups: [
      {
        title: "TUZ ODASI İMALATI",
        items: [
          item("Himalaya tuz ile", 1, 180000, "TAKIM"),
          item("Yarı serpme + yarı Himalaya tuz ile", 0, 170000, "TAKIM"),
          item("Serpme tuz ile", 0, 150000, "TAKIM"),
        ],
      },
      {
        title: "OPSİYONEL",
        items: [item("Tuz jeneratörü (yerli)", 0, 35000, "ADET", ["Tuz odasının tuz jeneratörü ile kullanılması tavsiye edilir. İyon üretimi jeneratör vasıtasıyla gerçekleşir."])],
      },
    ],
    footnotes: [
      "Fiyata dâhil olan yapım ve aksesuarlar:",
      "- Mekânın duvarlarının, tavanın ve zeminin tuz ile kaplanması",
      "- 77×197 cm ahşap kasalı temperli cam kapı",
      ...parsed.footnotes.filter((f) => !/Mekânın duvarlarının/.test(f)),
      "Seçenek değiştirmek için ilgili kalemin miktarını 1, diğerlerini 0 yapın; jeneratör isteniyorsa miktarını 1 yapın.",
    ],
    pricing: { currency: "TRY", exchangeRate: 1, discountPct: 0, laborCost: 0, extraCost: 0, profitMultiplier: 1.3, overheadCost: 0 },
  });
}

/** Buhar odası — Excel: yerli jeneratör + cam mozaik senaryosu (maliyet 258.530 × 1,3 = 336.089). */
function buharSheet(): TemplateSheet {
  return sheetSchema.parse({
    name: "BUHAR ODASI",
    title: "BUHAR ODASI FİYAT TEKLİFİ",
    specs: [
      { label: "Ölçüler (En × Boy × h)", value: "2 m × 3 m × 2,4 m" },
      { label: "Duvarlar, oturak ve zemin", value: "Cam mozaik" },
      { label: "Buhar jeneratörü", value: "Yerli, 9 kW/sa ~ 380 V, harici kumandalı — Türk malı, CE belgeli" },
    ],
    groups: [
      {
        title: "BUHAR ODASI İMALATI",
        items: [
          item("Buhar odası anahtar teslim imalatı (yerli jeneratör ile)", 1, 258530, "TAKIM", [
            "Yerli marka buhar jeneratörü, seçilecek ana yapı, tam otomatik kireç önleyici, harici kontrol paneli, 76×197 cm temperli buhar odası kapısı, Aquapanel tonozlu tavan, 4 adet su geçirmez spot aydınlatma, ergonomik buhar odası oturma grubu",
          ]),
        ],
      },
    ],
    footnotes: [
      "Müşteri tarafından yapılması gereken ön hazırlık:",
      "- Buhar odası yapılacak mekânın iç duvarları ince sıva ile terazili bir şekilde yapılması",
      "- Buhar odası içinde zemine ve buhar jeneratörü konulacak dış mekâna su giderinin konulması",
      "- Buhar jeneratörü konulacak mekâna 380V elektrik hattı çekilmesi",
      "- Kireç önleyici konulacak mekâna 220V elektrik hatlı priz konulması",
      "- Buhar jeneratörü konulacak mekâna vanalı soğuk su girişi sağlanması",
      "- Buhar odası girişi için bırakılan kapı ölçüsü 77×197 cm ölçüsünde olup terazili bir şekilde yapılması",
    ],
    pricing: { currency: "TRY", exchangeRate: 1, discountPct: 0, laborCost: 0, extraCost: 0, profitMultiplier: 1.3, overheadCost: 0 },
  });
}

/** Hamam — Excel'in müşteri bölümü (İCMAL): maliyet kalemleri × 1,35 = 630.871,88. */
function hamamSheet(): TemplateSheet {
  return sheetSchema.parse({
    name: "HAMAM",
    title: "HAMAM FİYAT TEKLİFİ",
    specs: [
      { label: "Ölçüler (En × Boy × h)", value: "2 m × 3 m × 2,5 m" },
      { label: "Duvarlar ve zemin", value: "Marmara Ekvator" },
      { label: "Oturaklar ve göbek taşı", value: "Marmara Ekvator" },
    ],
    groups: [
      {
        title: "YAPILACAK İŞLEMLER",
        items: [
          item("Hamam imalatı mermer ve kaplama uygulaması", 1, 226500, "GRUP", [
            "Duvarlar 250 cm yüksekliğe kadar 2 cm kalınlığında Marmara Ekvator ile kaplanacaktır. Oturmalar, göbek taşı ve zemin 2 cm kalınlığında Marmara Ekvator mermeri ile kaplanacaktır.",
          ]),
          item("Hamam ısıtma sistemi (sıcak su ile)", 1, 42750, "GRUP"),
          item("Kurnalar, çiniler ve su giderleri", 1, 18000, "GRUP", [
            "Tek parça mermerden mamul, hamamda kullanılan mermer cinsine ve mimariye göre kurna. Her kurna arkasına özel çini desenli kurna aynası.",
          ]),
          item("Hamam kapısı ve musluklar", 1, 44000, "GRUP", [
            "Kapı 77/197 cm, 8 mm yekpare temperli cam, alüminyum kasalı, silikon contalı, mıknatıslı kilitli. Antik Osmanlı çeşmeleri (2 adet batarya).",
          ]),
          item("Hamam tavan imalatı ve aydınlatma", 1, 42000, "GRUP", ["Tavan proje birebir aquapanel olarak, kubbeli imal edilecektir."]),
          item("Şap, sıva, izolasyon, gazbeton ve nakliye-montaj işleri", 1, 94062.5, "GRUP"),
        ],
      },
    ],
    footnotes: [
      "Tüm ürünlerimiz kullanıcı hataları dışında 2 yıl garantilidir.",
      "Geleneksel hamam kapısı istenirse: CNC işlemeli, 3 katlı fırınlanmış masif ahşap, Osmanlı ve Selçuklu desenli; kapı boşluğu 90/210 cm bırakılmalıdır.",
      "İşveren tarafından yapılması gereken ön hazırlık:",
      "- Soğuk - sıcak su hatları ve su giderinin hamamda gösterilen noktalara çekilmesi",
      "- Aydınlatma için kullanılacak enerji hattının bir pano ile kumanda edilecek şekilde hamam tavanına getirilmesi",
      "- Hamam bitmiş zemini sulu ısıtmada 15-18 cm, elektrikli ısıtmada 4-6 cm yukarı çıkar; zemin ile bitmiş kotun aynı olması isteniyorsa hamam zemininin aşağı indirilmesi tavsiye edilir (varolan zemine şap atılmasın).",
    ],
    pricing: { currency: "TRY", exchangeRate: 1, discountPct: 0, laborCost: 0, extraCost: 0, profitMultiplier: 1.35, overheadCost: 0 },
  });
}

const PRODUCT_INTRO: Record<string, string> = {
  havuz: "yüzme havuzu",
  sauna: "sauna",
  buhar: "buhar odası",
  hamam: "hamam",
  tuz: "tuz odası",
  komple: "havuz ve spa ürünleri",
};

async function main() {
  const companyQ = arg("company");
  const file = arg("file");
  const logo = arg("logo");
  const replace = process.argv.includes("--replace");
  if (!companyQ || !file) throw new Error('Kullanım: --company "<firma adı>" --file "<excel>" [--logo "<png/jpg>"] [--replace]');
  console.log(`Veritabanı sunucusu: ${new URL(process.env.APP_DATABASE_URL!).hostname.split(".")[0]}`);

  const company = await withPlatformBypass((tx) => tx.company.findFirst({ where: { name: { contains: companyQ, mode: "insensitive" }, deletedAt: null } }));
  if (!company) throw new Error(`Firma bulunamadı: ${companyQ}`);
  const ownerM = await withPlatformBypass((tx) =>
    tx.membership.findFirst({ where: { companyId: company.id, role: { in: ["OWNER", "ADMIN"] }, isActive: true }, orderBy: { role: "asc" }, include: { user: true } }),
  );
  if (!ownerM) throw new Error("Firmada aktif Sahip/Yönetici kullanıcı yok.");
  console.log(`Firma: ${company.name} · kullanıcı: ${ownerM.user.email}`);
  const session: TenantSession = {
    userId: ownerM.userId,
    userName: ownerM.user.name,
    userEmail: ownerM.user.email,
    companyId: company.id,
    companyName: company.name,
    companyStatus: "ACTIVE",
    role: ownerM.role,
    enabledModules: ["*"],
    membershipCount: 1,
  };

  // Excel → içerik (tarayıcıdaki içe aktarmayla aynı okuma)
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer", cellDates: true });
  const raw: RawSheet[] = wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }) as RawSheet["rows"],
  }));
  const { content: base, warnings } = parseWorkbook(raw);
  warnings.forEach((w) => console.log(`  uyarı: ${w}`));
  if (logo) {
    const ext = path.extname(logo).toLowerCase() === ".png" ? "png" : "jpeg";
    base.branding.logoDataUrl = `data:image/${ext};base64,${fs.readFileSync(logo).toString("base64")}`;
  }
  const byName = (n: string) => {
    const s = base.sheets.find((x) => x.name === n);
    if (!s) throw new Error(`Excel'de "${n}" sayfası yok.`);
    return s;
  };

  const sheets = {
    tasmali: byName("TAŞMALI"),
    tasmaliSer: { ...byName("TAŞMALI SER."), title: "TAŞMALI HAVUZ İNCE İŞLERİ (SERAMİK) FİYAT TEKLİFİ", summaryLabel: "TAŞMALI HAVUZ SERAMİK" },
    skimmer: byName("SKİMMER"),
    skimmerSer: { ...byName("SKİMMER SER."), title: "SKİMMERLİ HAVUZ İNCE İŞLERİ (SERAMİK) FİYAT TEKLİFİ", summaryLabel: "SKİMMERLİ HAVUZ SERAMİK" },
    panel: byName("PANEL HAVUZ"),
    opsiyonel: byName("Opsiyonel"),
    sauna: saunaSheet(byName("SAUNA")),
    buhar: buharSheet(),
    hamam: hamamSheet(),
    tuz: tuzSheet(byName("TUZ ODASI")),
    kalip: byName("KALIP HESAP"),
  };

  const defs: { name: string; description: string; product: keyof typeof PRODUCT_INTRO; sheets: TemplateSheet[] }[] = [
    { name: "Taşmalı Havuz Teklifi", description: "Taşmalı yüzme havuzu + seramik ince işler + opsiyonel ürünler", product: "havuz", sheets: [sheets.tasmali, sheets.tasmaliSer, sheets.opsiyonel] },
    { name: "Skimmerli Havuz Teklifi", description: "Skimmerli yüzme havuzu + seramik ince işler + opsiyonel ürünler", product: "havuz", sheets: [sheets.skimmer, sheets.skimmerSer, sheets.opsiyonel] },
    { name: "Panel (Liner) Havuz Teklifi", description: "Çelik panel gövdeli liner yüzme havuzu + opsiyonel ürünler", product: "havuz", sheets: [sheets.panel, sheets.opsiyonel] },
    { name: "Sauna Teklifi", description: "Sauna — iki ahşap seçeneği", product: "sauna", sheets: [sheets.sauna] },
    { name: "Buhar Odası Teklifi", description: "Cam mozaik buhar odası, yerli jeneratör", product: "buhar", sheets: [sheets.buhar] },
    { name: "Hamam Teklifi", description: "Marmara Ekvator mermer hamam", product: "hamam", sheets: [sheets.hamam] },
    { name: "Tuz Odası Teklifi", description: "Tuz odası — üç tuz seçeneği + opsiyonel jeneratör", product: "tuz", sheets: [sheets.tuz] },
    {
      name: "Komple Teklif (tüm sayfalar)",
      description: "Excel dosyasındaki tüm sayfalar — teklif hazırlarken gereken sayfaları seçin",
      product: "komple",
      sheets: [sheets.tasmali, sheets.tasmaliSer, sheets.skimmer, sheets.skimmerSer, sheets.panel, sheets.opsiyonel, sheets.sauna, sheets.buhar, sheets.hamam, sheets.tuz, sheets.kalip],
    },
  ];

  for (const d of defs) {
    const content: WorkbookContent = workbookContentSchema.parse(JSON.parse(JSON.stringify({ ...base, sheets: d.sheets })));
    content.cover.intro = content.cover.intro.replace(/yüzme havuzu/i, PRODUCT_INTRO[d.product]);

    const existing = await withTenant(company.id, (tx) => tx.quoteWorkbook.findFirst({ where: { kind: "TEMPLATE", name: d.name, deletedAt: null } }));
    if (existing && !replace) {
      console.log(`= ${d.name}: zaten var, atlandı (--replace ile yenilenir)`);
      continue;
    }
    if (existing) await withTenant(company.id, (tx) => tx.quoteWorkbook.update({ where: { id: existing.id }, data: { deletedAt: new Date() } }));
    const r = await createWorkbook(session, "TEMPLATE", { name: d.name, description: d.description, customerId: null, content });
    if (!r.ok) throw new Error(`${d.name}: ${r.message}`);
    const totals = content.sheets.map((s) => `${s.name} ${Math.round(sheetTotals(s).total).toLocaleString("tr-TR")} ₺`).join(" · ");
    console.log(`+ ${d.name}: ${totals}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
