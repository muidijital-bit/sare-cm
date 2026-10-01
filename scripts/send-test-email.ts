// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler .env'i otomatik okumaz.
import "dotenv/config";
/**
 * E-posta kurulumunu dener: RESEND_API_KEY + EMAIL_FROM ile örnek bir davet e-postası gönderir
 * (bağlantı sahte bir token içerir, kullanılamaz).
 *
 *   npx tsx scripts/send-test-email.ts --to adres@ornek.com
 */
import { isEmailConfigured } from "../src/lib/email/send";
import { sendInvitationEmail } from "../src/lib/email/templates";

async function main() {
  const i = process.argv.indexOf("--to");
  const to = i > 0 ? process.argv[i + 1] : undefined;
  if (!to) throw new Error("Kullanım: --to adres@ornek.com");
  if (!isEmailConfigured()) throw new Error("RESEND_API_KEY tanımlı değil (.env).");
  console.log(`Gönderen: ${process.env.EMAIL_FROM ?? "muiflow <bildirim@muiflow.com> (varsayılan)"}`);
  const { sent } = await sendInvitationEmail({ to, token: "test-baglantisi", companyName: "Deneme Şirketi", role: "SALES", inviterName: "muiflow" });
  console.log(sent ? `✅ Gönderildi → ${to} (gelen kutusu ve spam klasörünü kontrol edin)` : "❌ Gönderilemedi — yukarıdaki [email] hatasına bakın (alan adı doğrulandı mı?)");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
