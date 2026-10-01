import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "Stok · muiflow" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
