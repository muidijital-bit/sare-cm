import { Lock } from "react-feather";
import type { Module } from "@/lib/auth/rbac";
import type { TenantSession } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/modules/entitlements/resolve";
import { NAV_ITEMS } from "@/lib/nav-items";

/**
 * Bir modül sayfasına erişilemediğinde gösterilir. İki farklı sebep ayrılır:
 * modül şirketin paketinde/lisansında YOKSA (yükseltme çağrısı) ya da rolün yetkisi yoksa.
 */
export function AccessDenied({ session, module }: { session: Pick<TenantSession, "enabledModules">; module: Module }) {
  if (!isModuleEnabled(session.enabledModules, module)) {
    const name = NAV_ITEMS.find((n) => n.module === module)?.label ?? "Bu modül";
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Lock size={22} />
        </span>
        <h2 className="text-base font-semibold text-gray-900">{name} paketinizde yer almıyor</h2>
        <p className="mt-2 text-sm text-gray-500">
          Bu modülü kullanmak için paketinizi yükseltebilir veya modülü hesabınıza ekletebilirsiniz. Şirket yöneticinizle
          ya da destek ekibimizle iletişime geçin.
        </p>
      </div>
    );
  }
  return <p className="text-sm text-gray-500">Bu modülü görüntüleme yetkiniz yok.</p>;
}
