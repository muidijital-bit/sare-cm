import { requireSession, isSession, serviceResultToResponse } from "@/lib/api/handlers";
import { listCompanyUsers } from "@/lib/modules/users/service";

export async function GET() {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const result = await listCompanyUsers(session);
  return serviceResultToResponse(result);
}
