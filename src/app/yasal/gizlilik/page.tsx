import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Gizlilik ve Çerez Politikası · muiflow" };

export default function GizlilikPage() {
  return (
    <>
      <h1>Gizlilik ve Çerez Politikası</h1>
      <p>
        Bu politika, muiflow&apos;u kullanırken verilerinizin nasıl korunduğunu ve hangi çerezlerin kullanıldığını açıklar. Kişisel
        verilerin işlenmesine ilişkin ayrıntılı bilgi için <a href="/yasal/kvkk-aydinlatma">KVKK Aydınlatma Metni</a>&apos;ni inceleyin.
      </p>

      <h2>1. Verilerinizi nasıl koruyoruz</h2>
      <ul>
        <li>
          <strong>Şirketler arası izolasyon:</strong> Her işletmenin verisi veritabanı seviyesinde satır bazlı güvenlik (row-level
          security) ile ayrılır; bir işletmenin kullanıcısı başka bir işletmenin kaydına erişemez.
        </li>
        <li>
          <strong>Rol bazlı yetki:</strong> Kullanıcılar yalnızca rollerinin izin verdiği modülleri ve kayıtları görür (örn. satış rolü
          personel ve bordro verisini göremez).
        </li>
        <li>
          <strong>Şifreler:</strong> Şifreler geri döndürülemez biçimde özetlenerek (hash) saklanır; çalışanlarımız dahil kimse
          şifrenizi göremez. Ardışık başarısız girişlerde hesap geçici olarak kilitlenir.
        </li>
        <li>
          <strong>Yönetici erişimi:</strong> Platform yöneticisi girişleri iki adımlı doğrulama (2FA) gerektirir; doğrulama sırları
          şifreli saklanır.
        </li>
        <li>
          <strong>Şifreli iletim:</strong> Tüm trafik HTTPS (TLS) ile şifrelenir.
        </li>
        <li>
          <strong>İşlem kayıtları:</strong> Kayıtlar üzerindeki değişiklikler kim/ne zaman bilgisiyle izlenir.
        </li>
      </ul>

      <h2>2. Çerezler</h2>
      <p>
        muiflow <strong>yalnızca Hizmet&apos;in çalışması için zorunlu çerezleri</strong> kullanır. Reklam, pazarlama veya analiz
        (ör. Google Analytics) amaçlı çerez ya da üçüncü taraf izleme aracı kullanılmaz. Zorunlu çerezler, KVKK kapsamında açık rızaya
        tabi olmaksızın sözleşmenin ifası ve meşru menfaat hukuki sebeplerine dayanır.
      </p>
      <table>
        <thead>
          <tr>
            <th>Ad</th>
            <th>Tür</th>
            <th>Amaç</th>
            <th>Süre</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>next-auth.session-token</td>
            <td>Zorunlu, birinci taraf</td>
            <td>Oturumunuzu açık tutar (giriş yaptığınızı hatırlar)</td>
            <td>Oturum süresince (en fazla 30 gün; yönetici oturumları en fazla 12 saat)</td>
          </tr>
          <tr>
            <td>next-auth.csrf-token</td>
            <td>Zorunlu, birinci taraf</td>
            <td>Sahte istek (CSRF) saldırılarına karşı koruma</td>
            <td>Tarayıcı oturumu</td>
          </tr>
          <tr>
            <td>next-auth.callback-url</td>
            <td>Zorunlu, birinci taraf</td>
            <td>Girişten sonra bulunduğunuz sayfaya dönmenizi sağlar</td>
            <td>Tarayıcı oturumu</td>
          </tr>
        </tbody>
      </table>
      <p>
        Ayrıca tarayıcınızın yerel depolamasında (localStorage) yalnızca arayüz tercihiniz (ör. sol menünün daraltılmış olması)
        tutulur; bu bilgi sunucuya gönderilmez.
      </p>
      <p>
        Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz; ancak zorunlu çerezler engellenirse giriş yapılamaz.
      </p>

      <h2>3. Verilerin barındırıldığı yer</h2>
      <p>
        Hizmet yurt dışında bulunan altyapı sağlayıcıları üzerinde çalışır ({LEGAL.hosting.map((h) => `${h.name} — ${h.location}`).join("; ")}).
        Ayrıntılar ve hukuki dayanak için KVKK Aydınlatma Metni&apos;nin &quot;Aktarım&quot; bölümüne bakın.
      </p>

      <h2>4. İletişim</h2>
      <p>
        Gizlilikle ilgili sorularınız için: <strong>{LEGAL.kvkkEmail}</strong> · Genel iletişim: {LEGAL.contactEmail}
      </p>
    </>
  );
}
