# muiflow — Pazarlama Sitesi / Landing Page Brief'i

> Bu dosyayı olduğu gibi ChatGPT'ye (Sites/Canvas) yapıştır. Aşağıdaki her şey, sitenin **doğru ve
> uydurma içermeyen** bir şekilde yazılması için hazırlandı. "Yapılmayacaklar" bölümü önemli.

---

## 1. Senin görevin

Sen kıdemli bir SaaS pazarlama tasarımcısı ve conversion odaklı metin yazarısın. **muiflow**
adlı ürün için Türkçe, tek sayfalık (long-scroll) bir **landing page / pazarlama sitesi** hazırla.
Sitenin tek amacı: ziyaretçiyi **"Demo Talep Et"** formunu doldurmaya yönlendirmek.

Çıktı olarak istediğim: çalışan, responsive, temiz bir site (HTML/CSS/JS ya da bulunduğun
ortamın desteklediği en sade yapı) + tüm metinler Türkçe.

## 2. Ürün nedir?

**muiflow**, küçük ve orta ölçekli şirketler için bulut tabanlı bir **teklif → sipariş → tahsilat**
yönetim panelidir. Slogan yönü:

> **"Tekliften tahsilata tek panel."**

Sorun: KOBİ'ler teklifleri Excel/Word'de, siparişleri WhatsApp'ta, tahsilatları defterde tutuyor.
Hangi teklif bekliyor, hangi sipariş yolda, kimden ne kadar alacak var, kim ne yaptı — hep dağınık.

Çözüm: Müşteriyi kaydettiğin andan parayı tahsil ettiğin ana kadar her adım tek yerde, herkes
yetkisi kadarını görür.

## 3. Hedef kitle

- 3–50 çalışanlı şirketler: ajanslar, hizmet firmaları, üreticiler, toptancılar, esnaf/işletme sahipleri
- Karar verici: kurucu/işletme sahibi, satış veya muhasebe sorumlusu
- Teknik değiller; "Excel'den kurtulmak" isteyen, sade ve hızlı araç arıyorlar
- Türkiye pazarı: TL, KDV, Türkçe arayüz

## 4. Sitede vurgulanabilecek GERÇEK özellikler

Yalnızca aşağıdakileri özellik olarak yaz (bunlar ürüne gerçekten var):

1. **Müşteri yönetimi** — bireysel/kurumsal müşteriler, kişiler, etiketler, kaynak, sorumlu kullanıcı
2. **Teklifler** — teklif hazırlama, KDV ve iskonto hesabı, gönderme, kabul/ret, revizyon, tekliften siparişe tek tıkla dönüşüm
3. **Siparişler** — durum takibi (aşamalar), tekliften otomatik oluşturma, iptal/geri alma
4. **Tahsilatlar** — kısmi/tam ödeme, vade takibi, siparişlerle mahsuplaşma, vadesi geçmiş alacaklar
5. **Giderler** — gider kaydı ve kategoriler; kâr hesabına yansır
6. **Panel (dashboard)** — ciro, tahsilat, açık alacak, vadesi geçmiş alacak, gider, brüt/net kâr, bekleyen teklifler, aktif siparişler; tarih filtresi ve aylık grafikler
7. **İşlem geçmişi** — kim, ne zaman, neyi değiştirdi (denetim kaydı)
8. **Roller ve yetkiler** — Sahip, Yönetici, Satış, Muhasebe, Görüntüleyici; herkes yalnızca yetkisi kadarını görür
9. **Çoklu şirket** — bir kullanıcı birden fazla şirkete üye olup arasında geçiş yapabilir
10. **Modüler paketler** — Sadece ihtiyacın olan modülleri aç; paketine göre modül ekle/çıkar
11. **Mobil uyumlu** — telefonda alt menüyle rahat kullanım
12. **Veri izolasyonu** — her şirketin verisi diğerlerinden veritabanı seviyesinde ayrılır
13. **Anında arama, toplu işlemler, dışa aktarma** (tablolarda hızlı arama, çoklu seçim, dışa aktarım)

## 5. Farklılaştırıcı mesajlar (ana vaat)

- **Tek akış:** Teklif, sipariş, tahsilat aynı yerde — veriyi tekrar girmezsin
- **Sade:** 50 menülü dev CRM değil; satış-para akışına odaklı
- **Modüler:** Sadece kullandığın modül için ödersin
- **Şeffaf:** İşlem geçmişi ve yetkilerle "kim ne yaptı" bellidir
- **Hızlı kurulum:** Talep bırak, biz şirketini kuralım, ilk kullanıcın giriş yapsın

## 6. Sayfa yapısı (yukarıdan aşağıya)

1. **Üst menü (sticky):** logo, Özellikler, Nasıl Çalışır, Paketler, SSS, sağda **"Demo Talep Et"** butonu
2. **Hero:** H1 (ana vaat), 1-2 cümle alt başlık, birincil CTA "Demo Talep Et", ikincil CTA "Nasıl çalışır?"; sağda/altta ürün ekranı mockup'ı (dashboard temalı, mavi/lacivert)
3. **Sorun → çözüm bandı:** "Excel, WhatsApp, defter…" dağınıklığı vs. tek panel (kısa, karşılaştırmalı)
4. **Nasıl çalışır (3-4 adım):** Müşteri ekle → Teklif ver → Siparişe çevir → Tahsil et
5. **Özellikler:** 4.-bölümdeki maddelerden 6-8 kart (ikon + başlık + 1 cümle)
6. **Panel/rapor vitrini:** ciro, tahsilat, alacak, kâr kartlarını gösteren görsel bölüm
7. **Kimler için:** ajans, üretici, toptancı, hizmet firması — kısa persona kartları
8. **Paketler:** Free / Starter / Pro tablosu (fiyatlar aşağıda; "yer tutucu" notuna bak)
9. **SSS:** 6-8 soru (güvenlik, veri, mobil, kurulum süresi, iptal, destek, KVKK)
10. **Talep formu (son CTA):** alanlar aşağıda
11. **Footer:** logo, kısa açıklama, linkler (Gizlilik, KVKK Aydınlatma, Kullanım Şartları), iletişim e-postası, © muiflow

## 7. Talep formu

Alanlar: **Ad Soyad***, **Firma adı***, **E-posta***, **Telefon***, Sektör (açılır liste: Ajans, Üretim, Toptan/Perakende, Hizmet, İnşaat, Diğer), Çalışan sayısı (1-5, 6-20, 21-50, 50+), Not (isteğe bağlı).
- Onay kutusu: KVKK aydınlatma metnini okudum (zorunlu)
- Gönder butonu: "Demo Talep Et"
- Başarı mesajı: "Talebiniz alındı. En geç 1 iş günü içinde sizi arayacağız."
- Tarayıcıda doğrulama + spam koruması için gizli "honeypot" alan
- Gönderim adresi şimdilik yer tutucu: `POST {{FORM_ENDPOINT}}` (JSON). UTM parametrelerini (utm_source, utm_medium, utm_campaign) URL'den okuyup forma gizli alan olarak ekle.

## 8. Paketler (YER TUTUCU — kesin fiyat değil)

| Paket | Fiyat | İçerik |
|---|---|---|
| **Free** | 0 ₺ | Müşteriler + Teklifler, 2 kullanıcı, 100 müşteri |
| **Starter** | 499 ₺/ay (yıllık 4.990 ₺) | + Siparişler + Tahsilatlar, 5 kullanıcı, 1.000 müşteri |
| **Pro** | 999 ₺/ay (yıllık 9.990 ₺) | Tüm modüller (+ Giderler, İşlem Geçmişi), 25 kullanıcı, 20.000 müşteri |

Tabloda "Fiyatlar tanıtım amaçlıdır, kurulumda netleşir" notu olsun. Aylık/Yıllık geçiş anahtarı ekle
(yıllıkta "2 ay bedava" etiketi). Her paket butonu forma kaydırsın ("Bu paketle başla").

## 9. Marka ve tasarım

- **Marka adı:** muiflow (hep küçük harf yazılır)
- **Logo:** yatay yazı logosu (dalgalı "m" ve akıcı harfler). Logo dosyasını ben sağlayacağım; açık zeminde siyah, koyu zeminde beyaz kullanılır. Logo yoksa sadece küçük harfle "muiflow" yaz, logoyu kendin çizme.
- **Renkler:** ana lacivert `#152c69`, koyu zemin `#0a1638`, vurgu mavi `#3563d4`, açık mavi `#dbeafe`, arka plan beyaz/çok açık gri. Başarı yeşili ve uyarı turuncusu yalnızca küçük vurgularda.
- **Tipografi:** Inter (ya da benzeri temiz sans-serif), başlıklar kalın, bol boşluk
- **Stil:** modern, güven veren, sade B2B SaaS; hafif gradyan, yumuşak gölge, yuvarlatılmış köşeler (12-16px); "akış" fikrini çağrıştıran ince dalga/eğri çizgi motifleri
- **Ton:** samimi ama profesyonel, sade Türkçe, "siz" hitabı, jargon yok, kısa cümleler
- **Erişilebilirlik:** yeterli kontrast, klavye ile gezinme, `alt` metinleri, `prefers-reduced-motion`
- **Mobil öncelikli:** 390 px genişlikte kusursuz; yatay kaydırma olmasın

## 10. Örnek metin yönü (kendi cümlelerinle geliştir)

- H1: **Tekliften tahsilata tek panel.**
- Alt başlık: Teklif verin, siparişe çevirin, tahsil edin. Kim ne yapıyor, kimden ne kadar alacağınız var — hepsi tek yerde.
- CTA: **Demo Talep Et**
- Güven satırı: Türkçe arayüz · Mobil uyumlu · Verileriniz şirketinize özel ayrılır

## 11. SEO ve teknik

- `<title>`: "muiflow — Teklif, Sipariş ve Tahsilat Yönetimi Tek Panelde"
- Meta description (150-160 karakter), Open Graph etiketleri, `lang="tr"`, semantik başlıklar (tek H1)
- Sayfa hızlı olsun: görselleri optimize et, gereksiz kütüphane ekleme
- Çerez/analiz: yalnızca yer tutucu (`{{ANALYTICS_ID}}`); çerez bildirimi bandı ekle
- Favicon: yer tutucu (ben sağlayacağım)

## 12. YAPILMAYACAKLAR (çok önemli)

- **Uydurma müşteri yorumu, logo, "10.000 kullanıcı", "%99,9 uptime" gibi rakam/referans YAZMA.** Sosyal kanıt alanı gerekiyorsa "Yakında: müşteri hikayeleri" placeholder'ı koy.
- Şunları ürün özelliği olarak **anlatma** (henüz yok): e-Fatura/e-Arşiv entegrasyonu, WhatsApp ile teklif gönderme, online teklif onay linki, mobil uygulama (App Store/Play), API/entegrasyon marketplace'i, yapay zekâ özellikleri. İstersen "Yol haritası" başlığı altında "Yakında" etiketiyle, kesin tarih vermeden bahsedebilirsin.
- Rakip markaları adıyla anma/karşılaştırma tablosu yapma.
- Sertifika/uyumluluk iddiası (ISO 27001 vb.) yazma. Güvenlik için yalnızca doğru olanı söyle: şirket verileri birbirinden ayrılır, yetki/rol sistemi ve işlem geçmişi vardır.
- Gerçek telefon/adres/vergi bilgisi uydurma; yer tutucu kullan: `{{TELEFON}}`, `{{EPOSTA}}`, `{{ADRES}}`.

## 13. Teslimat

1. Tek sayfalık site (yukarıdaki bölüm sırasıyla)
2. Tüm metinler Türkçe ve yukarıdaki yer tutucular işaretli
3. Sonunda kısa bir liste: benim doldurmam gereken yer tutucular (`{{FORM_ENDPOINT}}`, `{{ANALYTICS_ID}}`, `{{TELEFON}}`, `{{EPOSTA}}`, logo, favicon, KVKK/gizlilik metinleri)
4. Bir de mobil ve masaüstü için hızlı bir kontrol notu (ne test ettin)

Önce bölüm yapısını ve H1/alt başlık için 3 alternatif öner, ben seçeyim; sonra siteyi üret.
