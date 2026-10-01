import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Proje detayı · muiflow" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
