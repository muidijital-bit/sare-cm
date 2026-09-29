import { appBaseUrl, renderEmail, sendEmail } from "@/lib/email/send";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  ACCOUNTING: "Muhasebe",
  SALES: "Satış",
  VIEWER: "Görüntüleyici",
};

/** Şirkete kullanıcı daveti (ilk Sahip daveti dahil). Bağlantı 72 saat geçerli (INVITATION_TOKEN_TTL_MS). */
export function sendInvitationEmail(opts: { to: string; token: string; companyName: string; role: string; inviterName?: string }) {
  const url = `${appBaseUrl()}/davet/${opts.token}`;
  const who = opts.inviterName ? `${opts.inviterName}, sizi` : "Sizi";
  const { html, text } = renderEmail({
    heading: `${opts.companyName} sizi muiflow'a davet ediyor`,
    paragraphs: [
      `${who} ${opts.companyName} şirketinin muiflow hesabına ${ROLE_LABEL[opts.role] ?? opts.role} rolüyle davet etti.`,
      "Daveti kabul etmek ve şifrenizi belirlemek için aşağıdaki düğmeye tıklayın.",
    ],
    ctaLabel: "Daveti kabul et",
    ctaUrl: url,
    footnote: "Bu bağlantı 72 saat geçerlidir. Bu daveti beklemiyorsanız e-postayı yok sayabilirsiniz.",
  });
  return sendEmail({ to: opts.to, subject: `${opts.companyName} · muiflow daveti`, html, text });
}

/** Şifre sıfırlama. Bağlantı 1 saat geçerli (PASSWORD_RESET_TOKEN_TTL_MS). */
export function sendPasswordResetEmail(opts: { to: string; token: string }) {
  const url = `${appBaseUrl()}/sifre-sifirla/${opts.token}`;
  const { html, text } = renderEmail({
    heading: "Şifrenizi sıfırlayın",
    paragraphs: [
      "muiflow hesabınız için bir şifre sıfırlama isteği aldık.",
      "Yeni şifrenizi belirlemek için aşağıdaki düğmeye tıklayın.",
    ],
    ctaLabel: "Yeni şifre belirle",
    ctaUrl: url,
    footnote: "Bu bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu isteği siz yapmadıysanız e-postayı yok sayın; şifreniz değişmez.",
  });
  return sendEmail({ to: opts.to, subject: "muiflow · Şifre sıfırlama", html, text });
}
