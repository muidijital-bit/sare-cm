import { tr } from "@/lib/i18n/tr";
import { LoginForm } from "./_components/login-form";

/**
 * Giriş ekranı fonu — WeTransfer tarzı tam-ekran fotoğraf + koyu degrade katmanı.
 * Fotoğraflar Unsplash Lisansı altında (ücretsiz, ticari kullanım dahil, atıf gerekmez)
 * indirilip public/login-bg/ altında self-host edilir — her sayfa yüklemesinde rastgele
 * biri seçilir (bkz. `dynamic = "force-dynamic"`: bu seçim build-time'da sabitlenmesin,
 * her istekte yeniden hesaplansın).
 */
export const dynamic = "force-dynamic";

const BACKGROUNDS = [
  "/login-bg/office-corridor.jpg",
  "/login-bg/team-table.jpg",
  "/login-bg/laptop-notes.jpg",
  "/login-bg/meeting-hands.jpg",
  "/login-bg/loft-presentation.jpg",
];

export default function GirisPage() {
  const background = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{ backgroundImage: `url(${background})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-brand-950/85 via-brand-950/70 to-brand-950/90" aria-hidden="true" />

      <div className="relative z-10 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt={tr.common.appName} className="h-16 w-auto drop-shadow-lg" />
        <p className="mb-6 mt-2 text-sm text-white/80">{tr.common.tagline}</p>

        <LoginForm />
      </div>
    </main>
  );
}
