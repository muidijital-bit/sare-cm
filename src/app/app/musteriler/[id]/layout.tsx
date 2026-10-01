import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Müşteri detayı · muiflow" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
