import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "KVKK Aydınlatma Metni · muiflow" };

export default function KvkkAydinlatmaPage() {
  return (
    <>
      <h1>Kişisel Verilerin Korunması Hakkında Aydınlatma Metni</h1>
      <p>
        Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) m.10 ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde
        Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, muiflow yazılım hizmetini (&quot;Hizmet&quot;) sunan {LEGAL.companyTitle}
        (&quot;Muimedya&quot; veya &quot;biz&quot;) tarafından hazırlanmıştır.
      </p>

      <h2>1. İki farklı rolümüz: veri sorumlusu ve veri işleyen</h2>
      <p>muiflow bir iş yazılımıdır ve kişisel veriler bakımından iki farklı sıfatla hareket ederiz:</p>
      <ul>
        <li>
          <strong>Veri sorumlusu olarak:</strong> Hizmet&apos;i kullanan kişilerin (kullanıcı hesabı sahipleri) hesap, oturum ve güvenlik
          verileri için. Bu metin esas olarak bu verileri kapsar.
        </li>
        <li>
          <strong>Veri işleyen olarak:</strong> Hizmet&apos;i kullanan işletmelerin (&quot;Müşteri&quot;) sisteme kendi girdiği verileri —
          örneğin kendi müşterilerinin, tedarikçilerinin ve çalışanlarının bilgileri (ad, iletişim, T.C. kimlik no, maaş, IBAN vb.) —
          için. Bu verilerin veri sorumlusu ilgili işletmedir; bu verilerle ilgili aydınlatma ve başvurular öncelikle o işletmeye
          yapılmalıdır. Biz bu verileri yalnızca Müşteri&apos;nin talimatıyla ve Hizmet&apos;in sunulması amacıyla işleriz (bkz.{" "}
          <a href="/yasal/kullanim-kosullari#veri-isleme">Kullanım Koşulları — Veri İşleme</a>).
        </li>
      </ul>

      <h2>2. Veri sorumlusu</h2>
      <table>
        <tbody>
          <tr>
            <th>Unvan</th>
            <td>{LEGAL.companyTitle}</td>
          </tr>
          <tr>
            <th>Adres</th>
            <td>{LEGAL.address}</td>
          </tr>
          <tr>
            <th>MERSİS</th>
            <td>{LEGAL.mersisNo}</td>
          </tr>
          <tr>
            <th>KEP</th>
            <td>{LEGAL.kepAddress}</td>
          </tr>
          <tr>
            <th>E-posta</th>
            <td>{LEGAL.kvkkEmail}</td>
          </tr>
        </tbody>
      </table>

      <h2>3. İşlenen kişisel veriler, amaçlar ve hukuki sebepler</h2>
      <table>
        <thead>
          <tr>
            <th>Veri kategorisi</th>
            <th>Örnekler</th>
            <th>Amaç</th>
            <th>Hukuki sebep (KVKK m.5/2)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Kimlik ve iletişim</td>
            <td>Ad soyad, e-posta, (varsa) telefon</td>
            <td>Hesap oluşturma, davet, şifre sıfırlama ve hizmet bildirimleri</td>
            <td>Sözleşmenin kurulması ve ifası (c)</td>
          </tr>
          <tr>
            <td>Müşteri işlem ve hesap</td>
            <td>Üye olunan şirket, rol, yetkiler, son giriş zamanı</td>
            <td>Yetkilendirme, çok şirketli kullanımın yönetimi</td>
            <td>Sözleşmenin ifası (c)</td>
          </tr>
          <tr>
            <td>İşlem güvenliği</td>
            <td>Şifre özeti (şifrenin kendisi saklanmaz), iki adımlı doğrulama sırrı (şifreli), başarısız giriş sayısı, oturum çerezi</td>
            <td>Hesap güvenliği, yetkisiz erişimin önlenmesi</td>
            <td>Hukuki yükümlülük (ç) — KVKK m.12 veri güvenliği; meşru menfaat (f)</td>
          </tr>
          <tr>
            <td>İşlem kayıtları (log)</td>
            <td>Kim, ne zaman, hangi kaydı değiştirdi; IP adresi ve tarayıcı bilgisi</td>
            <td>Denetim izi, güvenlik olaylarının incelenmesi, uyuşmazlıklarda ispat</td>
            <td>Hukuki yükümlülük (ç) — 5651 sayılı Kanun ve ilgili mevzuat; hakkın tesisi/korunması (e); meşru menfaat (f)</td>
          </tr>
          <tr>
            <td>Hukuki işlem</td>
            <td>Kullanım koşullarını onay tarihi ve sürümü</td>
            <td>Sözleşmenin kurulduğunun ispatı</td>
            <td>Sözleşmenin kurulması (c); hakkın tesisi (e)</td>
          </tr>
        </tbody>
      </table>
      <p>Özel nitelikli kişisel verileriniz (sağlık, biyometrik vb.) veri sorumlusu sıfatıyla tarafımızca işlenmez.</p>

      <h2>4. Toplama yöntemi</h2>
      <p>
        Veriler; davet kabulü ve hesap formları, uygulama içindeki işlemleriniz ve oturum çerezi aracılığıyla, elektronik ortamda ve
        otomatik yollarla toplanır.
      </p>

      <h2>5. Aktarım</h2>
      <p>Kişisel verileriniz yalnızca aşağıdaki alıcı gruplarına ve belirtilen amaçlarla aktarılır:</p>
      <ul>
        <li>Üyesi olduğunuz işletme (Müşteri) yetkilileri — kullanıcı yönetimi ve işlem kayıtları kapsamında.</li>
        <li>Altyapı hizmet sağlayıcılarımız — Hizmet&apos;in barındırılması ve e-posta gönderimi için (aşağıdaki tablo).</li>
        <li>Yetkili kamu kurum ve kuruluşları — kanuni yükümlülük veya usulüne uygun talep hâlinde.</li>
      </ul>

      <h3>Yurt dışına aktarım</h3>
      <p>
        Hizmet&apos;in altyapısı yurt dışında bulunan sağlayıcılar üzerinde çalışmaktadır. Bu nedenle kişisel verileriniz KVKK m.9
        kapsamında yurt dışına aktarılmaktadır. Aktarımlar, KVKK m.9/4 uyarınca Kurul&apos;ca ilan edilen standart sözleşmeler başta
        olmak üzere Kanun&apos;da öngörülen uygun güvenceler çerçevesinde yapılır.
      </p>
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

      <h2>6. Saklama süresi</h2>
      <p>
        Hesap verileri, hesabınız ve üyeliğiniz devam ettiği sürece; sonrasında ilgili mevzuattaki zamanaşımı ve saklama süreleri
        boyunca saklanır, süre sonunda silinir, yok edilir veya anonim hâle getirilir. İşlem kayıtları (log) ilgili mevzuatta öngörülen
        süre boyunca tutulur.
      </p>

      <h2>7. Haklarınız (KVKK m.11)</h2>
      <p>Kişisel verilerinizle ilgili olarak;</p>
      <ul>
        <li>işlenip işlenmediğini öğrenme ve işlenmişse buna ilişkin bilgi talep etme,</li>
        <li>işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
        <li>yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
        <li>eksik veya yanlış işlenmişse düzeltilmesini, KVKK m.7 şartları çerçevesinde silinmesini veya yok edilmesini isteme ve bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
        <li>münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme,</li>
        <li>kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
      </ul>
      <p>haklarına sahipsiniz.</p>

      <h2>8. Başvuru</h2>
      <p>
        Taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ&apos;e uygun olarak; kimliğinizi tespit edici bilgilerle
        birlikte <strong>{LEGAL.kvkkEmail}</strong> adresine (sistemde kayıtlı e-posta adresinizden), KEP adresimize ({LEGAL.kepAddress})
        veya yazılı olarak {LEGAL.address} adresine iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır.
      </p>
      <p>
        Bir işletmenin sisteme girdiği verilere (ör. o işletmenin müşterisi veya çalışanı olarak) ilişkin talepleriniz için lütfen
        doğrudan ilgili işletmeye başvurun; talebin bize ulaşması hâlinde ilgili işletmeye iletilir.
      </p>
    </>
  );
}
