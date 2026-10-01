import type { Metadata } from "next";

export const metadata: Metadata = { title: "Platform" };

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-brand-950 text-brand-100">{children}</div>;
}
