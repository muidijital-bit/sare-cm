import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { tr } from "@/lib/i18n/tr";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: tr.common.appName,
  description: "Çok şirketli CRM & satış yönetimi platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
