import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Kullanım Koşulları" };

export default function KullanimKosullariPage() {
  return (
    <>
      <h1>Kullanım Koşulları</h1>
      <p>
        Bu koşullar, {LEGAL.companyTitle} (&quot;Muimedya&quot;) tarafından sunulan muiflow bulut yazılım hizmetinin (&quot;Hizmet&quot;)
        kullanımını düzenler. Hizmet&apos;e erişen işletme (&quot;Müşteri&quot;) ve Müşteri adına Hizmet&apos;i kullanan kişiler
        (&quot;Kullanıcı&quot;) bu koşulları kabul etmiş sayılır. Ticari şartlar (paket, ücret, süre) ayrıca yapılan teklif veya
        sipariş formunda belirlenir; çelişki hâlinde o belge önceliklidir.
      </p>

      <h2>1. Hizmet</h2>
      <p>
        muiflow; müşteri, teklif, sipariş, tahsilat, gider, stok, proje, personel ve bordro gibi iş süreçlerinin yönetimi için internet
        üzerinden sunulan bir yazılımdır. Hangi modüllerin kullanılabileceği Müşteri&apos;nin paketine göre belirlenir. Muimedya,
        Hizmet&apos;i geliştirme, değiştirme ve iyileştirme hakkını saklı tutar; temel işlevleri olumsuz etkileyecek değişiklikler makul
        süre önceden bildirilir.
      </p>
      <p>
        Hizmet&apos;teki bordro, vergi ve SGK hesaplamaları <strong>bilgi amaçlıdır</strong>; resmî beyan ve ödemelerden önce bir mali
        müşavir tarafından kontrol edilmelidir. Hesaplama sonuçlarına dayanılarak yapılan beyanlardan Müşteri sorumludur.
      </p>

      <h2>2. Hesaplar ve güvenlik</h2>
      <ul>
        <li>Kullanıcı hesapları kişiseldir; hesap bilgileri başkalarıyla paylaşılamaz.</li>
        <li>Müşteri, kendi kullanıcılarını davet etmekten, rollerini belirlemekten ve ayrılan çalışanların erişimini kapatmaktan sorumludur.</li>
        <li>Yetkisiz erişim şüphesi derhâl {LEGAL.contactEmail} adresine bildirilmelidir.</li>
      </ul>

      <h2>3. Kabul edilebilir kullanım</h2>
      <p>Hizmet; hukuka aykırı içerik barındırmak, başkalarının haklarını ihlal etmek, sisteme yetkisiz erişim denemek, güvenlik
        önlemlerini aşmak, Hizmet&apos;i aşırı yükleyecek otomatik sorgular yapmak veya tersine mühendislik amacıyla kullanılamaz.</p>

      <h2>4. Müşteri verileri</h2>
      <p>
        Müşteri&apos;nin Hizmet&apos;e girdiği tüm veriler Müşteri&apos;ye aittir. Muimedya bu verileri yalnızca Hizmet&apos;i sunmak
        amacıyla işler, satmaz ve pazarlama amacıyla kullanmaz. Müşteri, Hizmet&apos;teki dışa aktarma araçlarıyla verilerini
        dilediği zaman alabilir. Sözleşmenin sona ermesinden sonra Müşteri talep ederse veriler iade edilir; aksi hâlde makul süre
        sonunda (yasal saklama yükümlülükleri saklı kalmak kaydıyla) silinir.
      </p>

      <h2 id="veri-isleme">5. Veri İşleme (KVKK — veri işleyen hükümleri)</h2>
      <p>
        Müşteri&apos;nin Hizmet&apos;e girdiği kişisel veriler (örn. Müşteri&apos;nin müşterileri, tedarikçileri ve çalışanlarına ait
        veriler) bakımından <strong>Müşteri veri sorumlusu</strong>, <strong>Muimedya veri işleyendir</strong> (KVKK m.3). Bu
        kapsamda:
      </p>
      <ol>
        <li>
          <strong>Talimat:</strong> Muimedya kişisel verileri yalnızca Hizmet&apos;in sunulması amacıyla ve Müşteri&apos;nin Hizmet
          üzerinden verdiği talimatlar doğrultusunda işler.
        </li>
        <li>
          <strong>Hukuki dayanak ve aydınlatma:</strong> Verileri sisteme giren Müşteri; ilgili kişileri aydınlatmaktan, gerekli hukuki
          sebebe (gerekirse açık rızaya) sahip olmaktan ve veri işleme envanteri/VERBİS yükümlülüklerinden sorumludur.
        </li>
        <li>
          <strong>Güvenlik:</strong> Muimedya KVKK m.12 uyarınca uygun teknik ve idari tedbirleri alır: şirketler arası veritabanı
          seviyesinde izolasyon, rol bazlı yetkilendirme, şifreli iletim (TLS), şifre özetleme, yönetici erişiminde iki adımlı
          doğrulama ve işlem kayıtları.
        </li>
        <li>
          <strong>Gizlilik:</strong> Verilere erişen Muimedya personeli gizlilik yükümlülüğü altındadır; destek amaçlı erişim yalnızca
          gerektiği ölçüde yapılır.
        </li>
        <li>
          <strong>Alt işleyenler:</strong> Hizmet aşağıdaki altyapı sağlayıcıları üzerinde çalışır; Müşteri bunların kullanımına onay
          verir. Alt işleyen değişiklikleri bu sayfada güncellenir.
          <table>
            <thead>
              <tr>
                <th>Sağlayıcı</th>
                <th>Hizmet</th>
                <th>Konum</th>
              </tr>
            </thead>
            <tbody>
              {[...LEGAL.hosting, LEGAL.emailProvider].map((h) => (
                <tr key={h.name}>
                  <td>{h.name}</td>
                  <td>{h.role}</td>
                  <td>{h.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
        <li>
          <strong>Yurt dışına aktarım:</strong> Altyapının konumu nedeniyle veriler yurt dışına aktarılır. Aktarım KVKK m.9&apos;da
          öngörülen uygun güvenceler (Kurul&apos;ca ilan edilen standart sözleşmeler dahil) çerçevesinde yapılır; Müşteri, gerekli
          bildirim ve aydınlatma yükümlülüklerini yerine getirir.
        </li>
        <li>
          <strong>İhlal bildirimi:</strong> Muimedya, Müşteri verilerini etkileyen bir veri ihlalini öğrendiğinde Müşteri&apos;yi
          gecikmeksizin bilgilendirir ve Müşteri&apos;nin KVKK m.12/5 kapsamındaki bildirim yükümlülüğüne makul ölçüde destek olur.
        </li>
        <li>
          <strong>İlgili kişi talepleri:</strong> Muimedya&apos;ya doğrudan ulaşan ilgili kişi başvuruları Müşteri&apos;ye iletilir;
          Muimedya, Müşteri&apos;nin bu talepleri yanıtlamasına makul ölçüde yardımcı olur.
        </li>
        <li>
          <strong>Sona erme:</strong> Sözleşme sona erdiğinde veriler Müşteri&apos;ye iade edilir veya silinir (Madde 4).
        </li>
      </ol>

      <h2>6. Ücretler</h2>
      <p>
        Paket ücretleri ve ödeme koşulları teklif veya sipariş formunda belirlenir. Ödemenin gecikmesi hâlinde Muimedya, yazılı
        bildirimden sonra hesabı askıya alabilir; askıya alma veriyi silmez.
      </p>

      <h2>7. Hizmet sürekliliği ve sorumluluk</h2>
      <p>
        Muimedya Hizmet&apos;in kesintisiz ve hatasız çalışması için makul çabayı gösterir; ancak planlı bakım, altyapı sağlayıcı
        kesintileri ve mücbir sebepler nedeniyle kesinti olabilir. Kanunen sınırlandırılamayan hâller (kast, ağır kusur) saklı kalmak
        üzere, Muimedya&apos;nın dolaylı zararlar ve kâr kaybından sorumluluğu yoktur; doğrudan zararlardan sorumluluğu, zararın
        doğduğu tarihten önceki 12 ayda Müşteri&apos;nin ödediği hizmet bedeli ile sınırlıdır.
      </p>

      <h2>8. Fikri mülkiyet</h2>
      <p>
        Hizmet&apos;in yazılımı, tasarımı ve markası Muimedya&apos;ya aittir. Müşteri&apos;ye, sözleşme süresince Hizmet&apos;i kendi iç
        işleri için kullanma hakkı tanınır; bu hak devredilemez.
      </p>

      <h2>9. Değişiklikler</h2>
      <p>
        Bu koşullar güncellenebilir. Önemli değişiklikler uygulama içinde bildirilir ve Kullanıcılardan yeniden onay istenir. Güncel
        sürüm her zaman bu sayfada yayımlanır.
      </p>

      <h2>10. Uygulanacak hukuk</h2>
      <p>Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda {LEGAL.jurisdiction} mahkemeleri ve icra daireleri yetkilidir.</p>

      <h2>11. İletişim</h2>
      <p>
        {LEGAL.companyTitle} · {LEGAL.address} · {LEGAL.contactEmail}
      </p>
    </>
  );
}
