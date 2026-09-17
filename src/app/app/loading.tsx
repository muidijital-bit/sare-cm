/**
 * Next.js App Router'ın özel `loading.tsx` dosyası — bu segment altındaki (tüm /app/*
 * sayfaları) sunucu verisi çekilirken (özellikle Neon'a giden sorgular gecikirse)
 * otomatik olarak gösterilir. Kullanıcı "sayfa tıklandı, 5sn boş ekran" hissi yerine
 * anında bir geri bildirim görür.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-800" />
        Yükleniyor…
      </div>
    </div>
  );
}
