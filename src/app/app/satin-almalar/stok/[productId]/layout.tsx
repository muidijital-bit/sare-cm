import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Stok hareketleri · muiflow" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
