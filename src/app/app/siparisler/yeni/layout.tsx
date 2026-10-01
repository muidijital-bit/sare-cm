import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Yeni sipariş · muiflow" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
