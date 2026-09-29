import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isSuperAdminSession } from "@/lib/api/platform-handlers";
import { zodErrorResponse, serviceResultToResponse } from "@/lib/api/handlers";
import { listCompanies, createCompany } from "@/lib/modules/platform/service";
import { createCompanyInputSchema } from "@/lib/validation/platform";
import { sendInvitationEmail } from "@/lib/email/templates";
import { appBaseUrl } from "@/lib/email/send";

export async function GET() {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;

  const companies = await listCompanies();
  return NextResponse.json({ items: companies });
}

export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!isSuperAdminSession(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = createCompanyInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const result = await createCompany(session, parsed.data);
  if (!result.ok) return serviceResultToResponse(result, 201);

  // İlk Sahip daveti e-postayla gider; bağlantı panelde de gösterilmeye devam eder (yedek yol).
  const { sent } = await sendInvitationEmail({
    to: parsed.data.ownerEmail,
    token: result.data.inviteToken,
    companyName: parsed.data.name,
    role: "OWNER",
  });
  return NextResponse.json({ ...result.data, inviteUrl: `${appBaseUrl()}/davet/${result.data.inviteToken}`, emailSent: sent }, { status: 201 });
}
