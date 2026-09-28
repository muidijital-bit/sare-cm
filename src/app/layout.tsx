import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { RouteLoadingOverlay } from "@/components/ui/route-loading-overlay";
import { NavigationPendingProvider } from "@/lib/ui/navigation-pending";
import { tr } from "@/lib/i18n/tr";

// TailAdmin arayüz dilinin bir parçası — bkz. tailwind.config.ts üstündeki not.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: tr.common.appName,
  description: "Çok şirketli CRM & satış yönetimi platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={`${outfit.variable} font-sans`}>
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
