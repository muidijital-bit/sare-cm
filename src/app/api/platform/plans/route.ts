import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isSuperAdminSession } from "@/lib/api/platform-handlers";
import { zodErrorResponse } from "@/lib/api/handlers";
import { listPlans, createPlan } from "@/lib/modules/platform/service";
import { createPlanInputSchema } from "@/lib/validation/platform";

export async function GET() {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;

  const plans = await listPlans();
  return NextResponse.json({ items: plans });
}

export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = createPlanInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const plan = await createPlan(session, parsed.data);
  return NextResponse.json(plan, { status: 201 });
}
