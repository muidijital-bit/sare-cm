import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { RouteLoadingOverlay } from "@/components/ui/route-loading-overlay";
import { NavigationPendingProvider } from "@/lib/ui/navigation-pending";
import { tr } from "@/lib/i18n/tr";

// Plus Jakarta Sans — modern SaaS ürünlerinde yaygın, Inter'den daha karakterli/"kaliteli"
// hissettiren, Türkçe karakterleri (ğ/ş/ı/ç) tam destekleyen ücretsiz bir Google Font.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: tr.common.appName,
  description: "Çok şirketli CRM & satış yönetimi platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={`${jakarta.variable} font-sans`}>
        <AuthSessionProvider>
          <NavigationPendingProvider>
            {children}
            <RouteLoadingOverlay />
          </NavigationPendingProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
