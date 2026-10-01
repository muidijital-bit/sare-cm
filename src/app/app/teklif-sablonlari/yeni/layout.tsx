import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Yeni teklif şablonu · muiflow" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
