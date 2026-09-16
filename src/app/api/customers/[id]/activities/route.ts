import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireWritable, isSession, serviceResultToResponse, zodErrorResponse } from "@/lib/api/handlers";
import { createActivity } from "@/lib/modules/customers/service";
import { activityInputSchema } from "@/lib/validation/customer";
import { withTenant } from "@/lib/db/tenant-context";
import { getRequiredScope } from "@/lib/auth/rbac";

/** MC-07/MC-08: bir müşterinin görüşme geçmişi. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const scope = getRequiredScope(session.role, "customer", "view");
  if (!scope) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

  const activities = await withTenant(session.companyId, (tx) =>
    tx.activity.findMany({
      where: {
        customerId: params.id,
        deletedAt: null,
        ...(scope === "own" ? { customer: { ownerUserId: session.userId } } : {}),
      },
      orderBy: { occurredAt: "desc" },
      include: { contact: { select: { name: true } } },
    }),
  );

  return NextResponse.json({ items: activities });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!isSession(session)) return session;
  const writable = requireWritable(session);
  if (writable) return writable;

  const body = await req.json().catch(() => null);
  const parsed = activityInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createActivity(session, params.id, parsed.data);
  return serviceResultToResponse(result, 201);
}
