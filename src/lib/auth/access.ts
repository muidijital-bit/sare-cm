import { getRequiredScope, type Action, type Module, type Scope } from "@/lib/auth/rbac";
import { isModuleEnabled } from "@/lib/modules/entitlements/resolve";
import type { TenantSession } from "@/lib/auth/session";

/**
 * Rol yetkisi (RBAC) + ürün lisansı (modül açık mı?) tek noktada. Şirketin paketinde/lisansında
 * olmayan modül, rol ne olursa olsun `null` (yasak) döner — menü, sayfa VE API aynı kararı verir.
 */
export function getScope(
  session: Pick<TenantSession, "role" | "enabledModules">,
  module: Module,
  action: Action,
): Scope | null {
  if (!isModuleEnabled(session.enabledModules, module)) return null;
  return getRequiredScope(session.role, module, action);
}
