/** Bkz. src/app/app/template.tsx — aynı mekanizma. */
import { RouteLoadedSignal } from "@/lib/ui/route-loaded-signal";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteLoadedSignal />
      {children}
    </>
  );
}
