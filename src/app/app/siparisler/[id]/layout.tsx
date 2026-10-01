import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Sipariş detayı · muiflow" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
