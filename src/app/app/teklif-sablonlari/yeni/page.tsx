import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantSession } from "@/lib/auth/session";
import { getScope } from "@/lib/auth/access";
import { canManageTemplates } from "@/lib/modules/quote-templates/service";
import { emptyContent } from "@/lib/modules/quote-templates/types";
import { WorkbookEditor } from "../_components/workbook-editor";

export default async function YeniSablonPage() {
  const session = await getTenantSession();
  if (!session) redirect("/app/sirket-sec");
  if (!canManageTemplates(session)) return <p className="text-sm text-gray-500">Şablon oluşturma yetkiniz yok (Sahip/Yönetici).</p>;

  const content = emptyContent();
  content.cover.greeting = "Sayın {musteri},";
  content.cover.closing = "Saygılarımla,";
  content.branding.companyTitle = session.companyName;

  return (
    <div>
      <Link href="/app/teklif-sablonlari" className="text-xs text-brand-700 hover:underline">
        ← Teklif Şablonları
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold text-gray-800">Yeni teklif şablonu</h1>
      <WorkbookEditor kind="TEMPLATE" initial={{ name: "", description: "", customerId: null, content }} canEdit canExportInternal={!!getScope(session, "quote", "edit")} />
    </div>
  );
}
