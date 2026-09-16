# Çok Şirketli CRM & Satış Yönetimi Platformu — V1 İsterler Dokümanı

**Sürüm:** 0.1 (taslak)
**Tarih:** 14.09.2026
**Durum:** Geliştirme öncesi analiz

---

## 1. Ürün Tanımı

Küçük ve orta ölçekli şirketlerin müşteri takibi, teklif, sipariş, tahsilat ve gider süreçlerini tek panelden yönettiği, abonelik modeliyle satılan web tabanlı bir uygulama (SaaS).

Her şirket kendi kullanıcılarını ve verisini yönetir; şirketler birbirinin verisini hiçbir koşulda göremez. Platform sahibi (siz) ayrı bir yönetim panelinden şirketleri açar, paket atar ve aboneliği yönetir.

**Hedef kullanıcı profili:** 2–25 kişilik satış ekibi olan, halihazırda Excel ile çalışan şirketler.

---

## 2. Alınan Kapsam Kararları

| Konu | Karar | Gerekçe |
|---|---|---|
| Teklif/sipariş satırları | Hibrit: katalogdan seçim + serbest satır | Tek seferlik kalemler kataloğu kirletmesin, ürün bazlı rapor da mümkün olsun |
| Fiyat davranışı | Katalog fiyatı satıra kopyalanır (snapshot) | Ürün fiyatı değişince geçmiş belgeler bozulmasın |
| Para birimi | V1'de yalnız TRY; şema çoklu para birimine hazır | Sonradan migration maliyeti çok yüksek |
| Maliyet | Satır bazında `unit_cost`, opsiyonel | Maliyetsiz kâr = ciro; sonradan geçmişe dönük hesaplanamaz |
| Abonelik | Manuel: şirketi platform yöneticisi açar, paketi atar | V1'de ödeme entegrasyonu yok, limit altyapısı yine de kurulur |

---

## 3. Katman Yapısı ve Çok Kiracılılık

Üç seviye ayrıştırılır:

1. **Platform** — şirket açma, paket/limit atama, askıya alma, kullanım istatistikleri
2. **Şirket (tenant)** — kendi verisi, kullanıcıları, ayarları
3. **Kullanıcı** — bir kullanıcı birden fazla şirkete üye olabilir

**İzolasyon modeli:** Tek veritabanı, her iş tablosunda `company_id` kolonu, veritabanı seviyesinde row-level security.

- `users` tablosunda `company_id` **bulunmaz**; ilişki `memberships` tablosu üzerinden kurulur.
- Tenant filtresi ORM/middleware katmanında zorunlu uygulanır, tek tek sorgulara bırakılmaz.
- Kullanıcı birden fazla şirkete üyeyse arayüzde aktif şirket seçici bulunur; oturum boyunca aktif şirket bağlamı korunur.
- Tüm ID'ler dışarıya UUID olarak verilir (ardışık ID ile başka kaydı deneme riski).

---

## 4. Roller ve Yetki Matrisi

**Standart roller:** Sahip, Yönetici, Satış, Muhasebe, Görüntüleyici

Yetki iki eksenden oluşur:

- **İşlem yetkisi:** görüntüle / ekle / düzenle / sil / dışa aktar
- **Veri kapsamı:** tüm şirket verisi / yalnızca kendi sorumluluğundaki kayıtlar

| Modül | Sahip | Yönetici | Satış | Muhasebe | Görüntüleyici |
|---|---|---|---|---|---|
| Şirket ayarları | Tam | Tam | — | — | — |
| Kullanıcı yönetimi | Tam | Ekle/Düzenle | — | — | — |
| Müşteri | Tam | Tam | Tam (kendi) | Görüntüle | Görüntüle |
| Teklif | Tam | Tam | Tam (kendi) | Görüntüle | Görüntüle |
| Sipariş | Tam | Tam | Ekle/Düzenle (kendi) | Görüntüle | Görüntüle |
| Tahsilat | Tam | Tam | Görüntüle | Tam | Görüntüle |
| Gider | Tam | Tam | — | Tam | — |
| Dashboard | Tam | Tam | Kısıtlı (kendi rakamları) | Finansal | Kısıtlı |
| İşlem geçmişi | Tam | Görüntüle | — | — | — |

- Yetkiler rol bazlıdır; V1'de kullanıcıya özel yetki düzenlemesi yapılmaz.
- "Kendi" kapsamı, kayda atanmış `owner_user_id` üzerinden belirlenir.
- Sahip rolü şirket başına en az bir kişide bulunmak zorundadır, son sahip silinemez veya rolü düşürülemez.

---

## 5. Fonksiyonel İsterler

### 5.1 Platform Yönetimi (Süper Admin)

- **PF-01** Yeni şirket oluşturma (şirket adı, yetkili e-postası, paket, abonelik bitiş tarihi)
- **PF-02** İlk Sahip kullanıcısına davet e-postası gönderme
- **PF-03** Paket tanımları ve limitleri: kullanıcı sayısı, müşteri sayısı, depolama alanı
- **PF-04** Şirket askıya alma / aktifleştirme. Askıdaki şirket salt-okunur moda geçer, verisi silinmez
- **PF-05** Abonelik bitiş tarihi yaklaşan şirketlerin listesi
- **PF-06** Şirket bazında kullanım özeti (kullanıcı, müşteri, teklif, sipariş sayıları, son giriş)
- **PF-07** Destek amaçlı şirkete geçici erişim; bu erişim işlem geçmişinde ayrıca işaretlenir
- **PF-08** Süper admin paneli ayrı bir alan adı/yol altında ve zorunlu 2FA ile çalışır

### 5.2 Şirket Ayarları

- **SA-01** Şirket bilgileri: unvan, vergi dairesi/no, adres, telefon, logo
- **SA-02** Varsayılan KDV oranı ve kullanılabilir oran listesi
- **SA-03** Belge numaralandırma formatı (örn. `TKF-{yıl}-{sıra}`), şirket bazında ardışık ve boşluksuz
- **SA-04** Müşteri kaynak listesi tanımlama (şirketin kendi ekleyebildiği)
- **SA-05** Gider kategorileri tanımlama
- **SA-06** Kasa/banka hesapları tanımlama
- **SA-07** Teklif geçerlilik süresi varsayılanı (gün)

### 5.3 Kimlik Doğrulama ve Kullanıcı Yönetimi

- **KY-01** E-posta + şifre ile giriş
- **KY-02** Şifre kuralları: min. 10 karakter, yaygın şifre kontrolü; hash için bcrypt/argon2
- **KY-03** Şifre sıfırlama (süreli, tek kullanımlık token)
- **KY-04** Kullanıcı davet akışı: e-posta + rol seçimi, davet linki 72 saat geçerli
- **KY-05** Kullanıcı pasifleştirme (silme değil; geçmiş kayıtlardaki ilişkisi korunur)
- **KY-06** Ardışık 5 başarısız girişte geçici kilitleme
- **KY-07** Oturum süresi ve "beni hatırla"; kullanıcı aktif oturumlarını görüp sonlandırabilir
- **KY-08** Paket kullanıcı limiti dolduğunda yeni davet engellenir ve limit mesajı gösterilir

### 5.4 Müşteri / CRM

- **MC-01** Müşteri kartı: bireysel / kurumsal ayrımı, unvan veya ad-soyad, vergi dairesi/no veya TCKN, adres
- **MC-02** Bir müşteriye birden fazla **kişi (contact)** eklenebilir: ad, unvan, telefon, e-posta, birincil kişi işareti
- **MC-03** Kaynak seçimi (şirket tanımlı liste)
- **MC-04** Müşteri durumu: potansiyel / aktif / pasif / kayıp
- **MC-05** Sorumlu kullanıcı ataması
- **MC-06** Serbest etiketleme
- **MC-07** Görüşme kaydı: tip (telefon, e-posta, ziyaret, WhatsApp, diğer), tarih, not, ilgili kişi
- **MC-08** Görüşmeye "sonraki aksiyon" ve hatırlatma tarihi eklenebilir; hatırlatma listesi ve panelde bildirim
- **MC-09** Müşteri detayında sekmeler: özet, görüşmeler, teklifler, siparişler, tahsilatlar, ekler
- **MC-10** Müşteri özetinde güncel bakiye: toplam sipariş, toplam tahsilat, açık alacak, vadesi geçmiş tutar
- **MC-11** Liste ekranında arama (unvan, telefon, vergi no), filtre (durum, kaynak, sorumlu, etiket), sayfalama
- **MC-12** Excel/CSV ile toplu müşteri içe aktarma: kolon eşleştirme ekranı, hatalı satır raporu, tekrar kontrolü
- **MC-13** Excel'e dışa aktarma (yetkiye bağlı, işlem geçmişine kaydedilir)
- **MC-14** Müşteri silme yumuşak silmedir; bağlı teklif/sipariş varsa silme engellenir, pasife alma önerilir

### 5.5 Teklif

- **TK-01** Teklif başlığı: müşteri, ilgili kişi, tarih, geçerlilik tarihi, para birimi, sorumlu kullanıcı, not
- **TK-02** Satır ekleme: katalogdan ürün seçimi **veya** serbest metin satırı
- **TK-03** Satır alanları: açıklama, miktar, birim, birim fiyat, iskonto (% veya tutar), KDV oranı, `unit_cost` (opsiyonel)
- **TK-04** Otomatik hesaplama: satır toplamı, ara toplam, iskonto toplamı, KDV toplamı, genel toplam
- **TK-05** Belge geneline iskonto uygulanabilir
- **TK-06** Durumlar: taslak → gönderildi → kabul / red / süresi doldu
- **TK-07** Süresi geçen teklifler otomatik "süresi doldu" durumuna geçer
- **TK-08** Kabul edilen tekliften tek tıkla sipariş oluşturma (satırlar kopyalanır, bağlantı korunur)
- **TK-09** Teklif revizyonu: mevcut tekliften kopya oluşturma (`TKF-2026-0007-R2`), ilişki takibi
- **TK-10** Gönderilmiş teklif düzenlenemez; düzenleme için revizyon açılır
- **TK-11** Teklif numarası şirket bazında otomatik ve benzersiz

### 5.6 Sipariş

- **SP-01** Sipariş tekliften türetilebilir veya sıfırdan oluşturulabilir
- **SP-02** Başlık: müşteri, tarih, termin tarihi, sorumlu kullanıcı, teslimat adresi, not
- **SP-03** Satır yapısı teklif ile aynı
- **SP-04** Durumlar: onaylandı → hazırlanıyor → teslim edildi → tamamlandı; her aşamadan iptal mümkün
- **SP-05** İptal edilen siparişin tutarları ciro ve açık alacak hesaplarından düşer
- **SP-06** Ödeme planı: peşinat ve taksit tarihleri/tutarları tanımlanabilir
- **SP-07** Sipariş detayında ödeme durumu: toplam, tahsil edilen, kalan, vadesi geçmiş
- **SP-08** Tahsilat yapılmış sipariş tutarı düşürülemez; uyarı verilir
- **SP-09** Teslim tarihi yaklaşan / geçen siparişler listesi

### 5.7 Tahsilat

- **TH-01** Tahsilat kaydı: müşteri, tarih, tutar, yöntem (nakit, havale, kredi kartı, çek), kasa/banka hesabı, açıklama, dekont eki
- **TH-02** Tahsilat siparişe bağlı olabilir veya cari hesaba (avans) girilebilir
- **TH-03** **Mahsuplaşma:** bir tahsilat birden fazla siparişe dağıtılabilir; bir sipariş birden fazla tahsilat alabilir (`payment_allocations`)
- **TH-04** Kısmi tahsilat desteği; kalan tutar otomatik hesaplanır
- **TH-05** Fazla ödeme cari alacak olarak kalır ve sonraki siparişe mahsup edilebilir
- **TH-06** İade kaydı (negatif tahsilat), gerekçe zorunlu
- **TH-07** Vadesi geçmiş alacaklar listesi: gecikme günü, tutar, sorumlu kullanıcı, müşteri
- **TH-08** Tahsilat silme yerine iptal; iptal gerekçesi ve işlem geçmişi kaydı zorunlu

### 5.8 Gider

- **GD-01** Gider kaydı: tarih, kategori, tutar, KDV, tedarikçi/açıklama, ödeme yöntemi, fiş/fatura eki
- **GD-02** Kategori bazlı raporlama
- **GD-03** Tekrarlayan gider tanımı (aylık kira, abonelik) ve otomatik oluşturma
- **GD-04** Gider onayı V1 kapsamında değildir

### 5.9 Dashboard

Varsayılan dönem: içinde bulunulan ay. Tarih aralığı filtresi ve önceki dönemle karşılaştırma bulunur.

**Kartlar:** Ciro, Tahsilat, Açık alacak, Vadesi geçmiş alacak, Gider, Brüt kâr, Net kâr, Bekleyen teklifler, Aktif siparişler

**Grafikler:**
- Aylık ciro–tahsilat karşılaştırması (son 12 ay)
- Gider kategori dağılımı
- Teklif durum hunisi (gönderildi → kabul → sipariş)
- En yüksek cirolu 10 müşteri

**Listeler:** bugünün hatırlatmaları, vadesi geçmiş alacaklar, termini yaklaşan siparişler, süresi dolmak üzere olan teklifler

**Kırılımlar:** kullanıcı, kaynak, müşteri bazında filtre. Satış rolündeki kullanıcı yalnız kendi rakamlarını görür.

### 5.10 İşlem Geçmişi (Audit Log)

- **IG-01** Kayıt oluşturma, güncelleme, silme işlemlerinde: kullanıcı, tarih-saat, IP, modül, kayıt ID
- **IG-02** Güncellemelerde alan bazında eski değer → yeni değer farkı
- **IG-03** Loglanacak ek olaylar: giriş/çıkış, başarısız giriş, yetki değişikliği, kullanıcı davet/pasifleştirme, dışa aktarma, süper admin erişimi
- **IG-04** Log kayıtları uygulama üzerinden değiştirilemez ve silinemez
- **IG-05** Kayıt detay ekranında "değişiklik geçmişi" sekmesi
- **IG-06** Genel log ekranı: kullanıcı, tarih aralığı, modül, işlem tipi filtreleri
- **IG-07** Tüm iş tablolarında yumuşak silme (`deleted_at`, `deleted_by`)
- **IG-08** Log saklama süresi en az 12 ay

---

## 6. Durum Makineleri

**Teklif**
```
taslak ──gönder──> gönderildi ──┬──> kabul ──> (sipariş oluşturulur)
                                ├──> red
                                └──> süresi doldu (otomatik)
```

**Sipariş**
```
onaylandı ──> hazırlanıyor ──> teslim edildi ──> tamamlandı
     └────────────┴───────────────┴──────> iptal
```

**Ödeme durumu (siparişten türetilir, ayrı alan tutulmaz)**
```
ödenmedi → kısmi ödendi → tamamen ödendi   (+ vadesi geçmiş işareti)
```

---

## 7. Metrik Tanımları

Dashboard rakamlarının tek bir tanımı olmalıdır; aksi halde her ekranda farklı sayı çıkar.

| Metrik | Formül |
|---|---|
| Ciro | Dönem içindeki iptal edilmemiş siparişlerin KDV hariç toplamı (tahakkuk) |
| Tahsilat | Dönem içinde girilen, iptal edilmemiş ödemelerin toplamı (nakit) |
| Açık alacak | Tüm siparişlerin KDV dahil toplamı − toplam tahsilat |
| Vadesi geçmiş alacak | Ödeme planında vadesi bugünden önce olan ve tahsil edilmemiş tutarlar |
| Satılan malın maliyeti | Sipariş satırlarının `unit_cost × miktar` toplamı |
| Brüt kâr | Ciro − satılan malın maliyeti (maliyet girilmemiş satır varsa metrik "eksik veri" uyarısıyla gösterilir) |
| Net kâr | Brüt kâr − dönem gideri |
| Bekleyen teklifler | Durumu "gönderildi" olan tekliflerin sayısı ve toplam tutarı |
| Aktif siparişler | Durumu onaylandı/hazırlanıyor/teslim edildi olan siparişler |

**Not:** Tutarlar KDV hariç raporlanır; KDV dahil değer ayrıca gösterilir. Açık alacak tahsil edilecek gerçek tutar olduğu için KDV dahil hesaplanır.

---

## 8. Veri Modeli Taslağı

```
-- Platform
plans(id, name, max_users, max_customers, max_storage_mb, price)
companies(id, name, plan_id, status, trial_ends_at, subscription_ends_at, settings_json)

-- Kimlik
users(id, email, password_hash, name, phone, last_login_at, is_active)
memberships(id, user_id, company_id, role, scope, is_active)

-- CRM
customers(id, company_id, type, title, tax_office, tax_number, address,
          source_id, status, owner_user_id, ...audit)
contacts(id, company_id, customer_id, name, position, phone, email, is_primary)
customer_sources(id, company_id, name)
activities(id, company_id, customer_id, contact_id, type, occurred_at, note,
           next_action, remind_at, ...audit)
tags(id, company_id, name) / customer_tags(customer_id, tag_id)

-- Satış
products(id, company_id, code, name, unit, list_price, default_cost, vat_rate, is_active)
quotes(id, company_id, number, customer_id, contact_id, status, issue_date,
       valid_until, currency, exchange_rate, discount_total, subtotal, vat_total,
       grand_total, parent_quote_id, owner_user_id, ...audit)
quote_items(id, quote_id, product_id NULL, description, quantity, unit,
            unit_price, unit_cost, discount, vat_rate, line_total)
orders(id, company_id, number, customer_id, quote_id NULL, status, order_date,
       due_date, ... aynı tutar alanları ..., owner_user_id, ...audit)
order_items(...quote_items ile aynı yapı...)
payment_schedules(id, order_id, due_date, amount, description)

-- Finans
payments(id, company_id, customer_id, account_id, paid_at, amount, method,
         reference, note, is_cancelled, cancel_reason, ...audit)
payment_allocations(id, payment_id, order_id, amount)
accounts(id, company_id, name, type)          -- kasa / banka
expenses(id, company_id, category_id, spent_at, amount, vat_amount, vendor,
         method, account_id, note, recurring_rule, ...audit)
expense_categories(id, company_id, name)

-- Ortak
attachments(id, company_id, entity_type, entity_id, file_path, file_name, size, uploaded_by)
audit_logs(id, company_id, user_id, entity_type, entity_id, action,
           changes_json, ip, user_agent, created_at)
notifications(id, company_id, user_id, type, payload_json, read_at)
```

**Tüm iş tablolarında ortak alanlar:** `company_id`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`

**Tutar alanları:** `decimal(18,4)` — float kullanılmaz. Para birimi ve kur kolonları belge başlığında tutulur.

---

## 9. Fonksiyonel Olmayan İsterler

**Güvenlik**
- Tüm trafik HTTPS
- Tenant izolasyonu için otomatik test seti (başka şirketin kaydına erişim denemeleri)
- Dosya yüklemede tip/boyut doğrulaması, yüklenen dosyalar uygulama kökü dışında saklanır
- Şifre, token gibi veriler loglanmaz
- Oran sınırlama: giriş, şifre sıfırlama, dışa aktarma uçları

**KVKK / Veri koruma**
- Aydınlatma metni ve açık rıza akışı
- Şirketlerle veri işleyen sözleşmesi (siz veri işleyen, şirket veri sorumlusu)
- Şirket bazında tüm veriyi dışa aktarma (JSON/Excel)
- Silme talebi karşılama süreci ve kalıcı silme mekanizması
- Verinin tutulduğu sunucu lokasyonunun belirtilmesi

**Performans**
- Liste ekranları 10.000 kayıtta 1 saniyenin altında yanıt
- Tüm listelerde sunucu taraflı sayfalama ve filtreleme
- Dashboard sorguları için gerekirse özetleme tablosu

**Kullanılabilirlik**
- Mobil uyumlu arayüz (saha satışı için müşteri, görüşme, teklif görüntüleme öncelikli)
- Türkçe arayüz; metinler dil dosyasında tutulur
- Tarih, sayı ve para formatı TR yerelleştirmesi

**Operasyon**
- Günlük otomatik yedek, geri yükleme prosedürünün test edilmiş olması
- Hata izleme ve uygulama logları
- Ayrı test ve canlı ortam, veritabanı migration yönetimi

---

## 10. V1 Kapsamı Dışında

- e-Fatura / e-Arşiv entegrasyonu
- Ödeme altyapısı entegrasyonu (iyzico, Stripe vb.)
- Stok takibi ve depo yönetimi
- Satış hedefi ve prim hesaplama
- Mobil uygulama (yalnız mobil uyumlu web)
- Genel API ve webhook
- Çoklu dil
- Özelleştirilebilir rol/yetki tanımları
- Onay akışları

---

## 11. Faz Planı

**V1 — Çekirdek**
Platform yönetimi, kimlik ve roller, şirket ayarları, müşteri CRM, teklif, sipariş, tahsilat, gider, dashboard, işlem geçmişi

**V1.5 — Günlük kullanımı tamamlayan işlevler**
Teklif/sipariş PDF çıktısı, e-posta ile gönderim, hatırlatma bildirimleri, Excel içe/dışa aktarma yaygınlaştırması, çoklu para birimi aktivasyonu, kullanıcı bazlı yetki ince ayarı

**V2 — Büyüme**
e-Fatura entegrasyonu, ödeme altyapısı ve self-servis abonelik, satış hedefi/prim, gelişmiş raporlar, API, mobil uygulama

---

## 12. Açık Maddeler

1. Teklif PDF çıktısı V1'de gerçekten dışarıda kalabilir mi? Teklif gönderimi ürünün ana vaadi ise V1'e alınmalı.
2. Şirket kaydı yalnız sizin tarafınızdan mı açılacak, ileride self-servis deneme düşünülüyor mu?
3. Müşteri bazında cari hesap ekstresi (tarih sıralı borç/alacak dökümü) V1'de istenecek mi?
4. Sipariş ile fatura ayrımı yapılacak mı, yoksa sipariş fatura yerine mi geçecek?
5. Fiyat listesi / müşteriye özel fiyat ihtiyacı var mı?
6. Hatırlatma bildirimleri yalnız uygulama içi mi, e-posta da gönderilecek mi?
7. Dosya eki için depolama limiti ve toplam boyut sınırı ne olacak?
8. Paket seviyeleri ve fiyatlandırma nasıl kurgulanacak?
