import { requireSession, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { dismissOnboarding } from "@/lib/modules/onboarding/service";

/** Panel "Kurulumu tamamla" kartını firma için kalıcı olarak gizle (Sahip/Yönetici). */
export async function POST() {
  const session = await requireSession();
  if (!isSession(session)) return session;
  return serviceResultToResponse(await dismissOnboarding(session));
}
