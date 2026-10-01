import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Gider detayı · muiflow" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
