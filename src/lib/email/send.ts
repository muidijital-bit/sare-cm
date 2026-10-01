/**
 * İşlemsel e-posta gönderimi — Resend HTTP API'si (https://resend.com/docs/api-reference/emails/send-email).
 * SDK eklenmedi: tek bir POST isteği; bağımlılık ve paket boyutu gereksiz.
 *
 * Ortam değişkenleri:
 * - RESEND_API_KEY : tanımsızsa e-posta GÖNDERİLMEZ (sessizce `{ sent: false }` döner) — yerel geliştirme
 *                    ve anahtar henüz eklenmemiş ortamlar eskisi gibi çalışır (bağlantı UI'da gösterilir).
 * - EMAIL_FROM     : gönderen, örn. `muiflow <bildirim@muiflow.com>` (alan adı Resend'de doğrulanmış olmalı;
 *                    bu adreste gerçek bir posta kutusu olması GEREKMEZ).
 * - EMAIL_REPLY_TO : isteğe bağlı — alıcı "Yanıtla" derse yanıtın gideceği gerçek adres (örn. destek kutusu).
 *
 * Gönderim hatası çağıranın işlemini BOZMAZ (davet/sıfırlama kaydı zaten oluşmuştur); hata loglanır ve
 * `{ sent: false }` döner — çağıran gerekirse bağlantıyı UI'da göstermeye devam eder.
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** E-postalardaki mutlak bağlantılar için müşteri uygulamasının kök adresi. */
export function appBaseUrl(): string {
  if (process.env.APP_HOSTNAME) return `https://${process.env.APP_HOSTNAME}`;
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function sendEmail(input: { to: string; subject: string; html: string; text: string }): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "muiflow <bildirim@muiflow.com>",
        to: [input.to],
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[email] Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[email] gönderim hatası", e);
    return { sent: false };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Tek tip, e-posta istemcisi uyumlu (tablo tabanlı, satır içi stil) şablon. */
export function renderEmail(opts: { heading: string; paragraphs: string[]; ctaLabel: string; ctaUrl: string; footnote: string }) {
  const p = opts.paragraphs
    .map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:#344054">${escapeHtml(t)}</p>`)
    .join("");
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e7ec;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#101828;letter-spacing:-0.5px">muiflow</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#101828">${escapeHtml(opts.heading)}</h1>
${p}
<p style="margin:24px 0"><a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${escapeHtml(opts.ctaLabel)}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#667085">Düğme çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br><a href="${escapeHtml(opts.ctaUrl)}" style="color:#6d28d9;word-break:break-all">${escapeHtml(opts.ctaUrl)}</a></p>
<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#98a2b3">${escapeHtml(opts.footnote)}</p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#98a2b3">muiflow · Muimedya</p>
</td></tr></table></body></html>`;
  const text = [opts.heading, "", ...opts.paragraphs, "", `${opts.ctaLabel}: ${opts.ctaUrl}`, "", opts.footnote].join("\n");
  return { html, text };
}
