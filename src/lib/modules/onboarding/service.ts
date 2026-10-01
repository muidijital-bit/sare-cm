import type { Prisma } from "@prisma/client";
import { withTenant, withTenantRead } from "@/lib/db/tenant-context";
import { getScope } from "@/lib/auth/access";
import type { TenantSession } from "@/lib/auth/session";
import type { Module } from "@/lib/auth/rbac";
import { type ServiceResult, forbidden } from "@/lib/modules/result";

/**
 * Panel "Kurulumu tamamla" kontrol listesi. Adımlar firmanın gerçek verisinden hesaplanır (elle
 * işaretleme yok): kayıt oluştuğu anda adım tamamlanır. Yalnızca Sahip/Yönetici görür; kullanıcının
 * yetkisi/lisansı olmayan modüllerin adımları listelenmez. Kapatma bilgisi companies.settings'te.
 */
export interface OnboardingStep {
  key: string;
  title: string;
  hint: string;
  href: string;
  cta: string;
  done: boolean;
}

export interface Onboarding {
  steps: OnboardingStep[];
  doneCount: number;
}

const DISMISS_KEY = "onboardingDismissedAt";

export function canSeeOnboarding(session: TenantSession) {
  return getScope(session, "companySettings", "edit") === "all";
}

export async function getOnboarding(session: TenantSession): Promise<Onboarding | null> {
  if (!canSeeOnboarding(session)) return null;
  const [company, users, invites, customers, products, templates, quotes, orders] = await withTenantRead(session.companyId, (db) => [
    db.company.findUniqueOrThrow({ where: { id: session.companyId }, select: { taxNumber: true, address: true, phone: true, settings: true } }),
    db.membership.count({ where: { companyId: session.companyId } }),
    db.invitationToken.count({ where: { companyId: session.companyId } }),
    db.customer.count({ where: { deletedAt: null } }),
    db.product.count({ where: { deletedAt: null } }),
    db.quoteWorkbook.count({ where: { kind: "TEMPLATE", deletedAt: null } }),
    db.quote.count({ where: { deletedAt: null } }),
    db.order.count({ where: { deletedAt: null } }),
  ] as const);

  const settings = (company.settings ?? {}) as Record<string, unknown>;
  if (settings[DISMISS_KEY]) return null;

  const all: (OnboardingStep & { module: Module })[] = [
    {
      key: "company",
      module: "companySettings",
      title: "Şirket bilgilerini girin",
      hint: "Vergi no, adres ve telefon tekliflerde ve belgelerde kullanılır.",
      href: "/app/ayarlar",
      cta: "Ayarlar",
      done: !!(company.taxNumber && company.address && company.phone),
    },
    {
      key: "users",
      module: "userManagement",
      title: "Ekip arkadaşlarınızı davet edin",
      hint: "Satış, muhasebe gibi rollerle her kişi yalnızca yetkili olduğu yeri görür.",
      href: "/app/kullanicilar",
      cta: "Kullanıcı davet et",
      done: users > 1 || invites > 0,
    },
    {
      key: "customer",
      module: "customer",
      title: "İlk müşterinizi ekleyin",
      hint: "Teklif, sipariş ve tahsilatlar müşteriye bağlanır.",
      href: "/app/musteriler/yeni",
      cta: "Müşteri ekle",
      done: customers > 0,
    },
    {
      key: "product",
      module: "product",
      title: "Ürün ve hizmetlerinizi ekleyin",
      hint: "Tekliflerde ürünü seçince fiyat ve maliyet kendiliğinden gelir.",
      href: "/app/urunler/yeni",
      cta: "Ürün ekle",
      done: products > 0,
    },
    {
      key: "template",
      module: "quote",
      title: "Teklif şablonu oluşturun",
      hint: "Mevcut Excel teklif dosyanızı içe aktarın; logo ve antet bir kez girilir.",
      href: "/app/teklif-sablonlari/yeni",
      cta: "Şablon oluştur",
      done: templates > 0,
    },
    {
      key: "quote",
      module: "quote",
      title: "İlk teklifinizi hazırlayın",
      hint: "Şablondan ya da sıfırdan; müşteriye Excel olarak gönderin.",
      href: templates > 0 ? "/app/teklif-sablonlari" : "/app/teklifler/yeni",
      cta: "Teklif hazırla",
      done: quotes > 0,
    },
    {
      key: "order",
      module: "order",
      title: "Onaylanan teklifi siparişe çevirin",
      hint: "Teklif detayında “Siparişe dönüştür” — tahsilatlar siparişten takip edilir.",
      href: "/app/teklifler",
      cta: "Tekliflere git",
      done: orders > 0,
    },
  ];

  const steps = all.filter((s) => getScope(session, s.module, "create") || getScope(session, s.module, "edit")).map(({ module: _m, ...s }) => s);
  return { steps, doneCount: steps.filter((s) => s.done).length };
}

export async function dismissOnboarding(session: TenantSession): Promise<ServiceResult<{ ok: true }>> {
  if (!canSeeOnboarding(session)) return forbidden();
  return withTenant(session.companyId, async (tx) => {
    const c = await tx.company.findUniqueOrThrow({ where: { id: session.companyId }, select: { settings: true } });
    const settings = { ...((c.settings ?? {}) as Record<string, unknown>), [DISMISS_KEY]: new Date().toISOString() };
    await tx.company.update({ where: { id: session.companyId }, data: { settings: settings as Prisma.InputJsonValue } });
    return { ok: true as const, data: { ok: true as const } };
  });
}
