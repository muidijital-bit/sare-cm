/** Bkz. src/app/app/template.tsx — aynı mekanizma (ve aynı kural: loading.tsx eklemeyin). */
import { RouteLoadedSignal } from "@/lib/ui/route-loaded-signal";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteLoadedSignal />
      {children}
    </>
  );
}
