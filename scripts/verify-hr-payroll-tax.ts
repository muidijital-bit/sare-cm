// .env dosyasını manuel yükler — tsx ile doğrudan çalıştırılan betikler .env'i otomatik okumaz.
import "dotenv/config";
/**
 * Personel Yönetimi / Bordro / Vergi & SGK Takibi modülleri uçtan uca doğrulaması:
 * yetki, personel CRUD, izin kaydı, bordro otomatik hesaplama + kalem düzenleme + tamamlama,
 * vergi/SGK yükümlülüğü oluşturma/ödeme, RLS izolasyonu, lisans kapalıyken 403.
 * Test verisi sonunda tamamen temizlenir.
 */
import { withPlatformBypass } from "../src/lib/db/tenant-context";
import { createEmployee, updateEmployee, deleteEmployee, createLeaveRequest, deleteLeaveRequest, getEmployee } from "../src/lib/modules/employees/service";
import { createPayrollRun, getPayrollRun, updatePayrollRunItem, completePayrollRun, deletePayrollRun } from "../src/lib/modules/payroll/service";
import { calculatePayrollItem } from "../src/lib/modules/payroll/calc";
import { createTaxObligation, payTaxObligation, deleteTaxObligation, getUpcomingObligations } from "../src/lib/modules/tax-obligations/service";
import { getScope } from "../src/lib/auth/access";
import type { TenantSession } from "../src/lib/auth/session";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) console.log(`✅ ${label}`);
  else { console.error(`❌ ${label}`); failures++; }
}

async function main() {
  const owner = await withPlatformBypass((tx) => tx.user.findUniqueOrThrow({ where: { email: "sare@demo.test" } }));
  const company = await withPlatformBypass((tx) => tx.company.findFirstOrThrow({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } }));
  const account = await withPlatformBypass((tx) => tx.account.findFirstOrThrow({ where: { companyId: company.id, isActive: true } }));

  const base: TenantSession = {
    userId: owner.id, userName: owner.name, userEmail: owner.email, companyId: company.id, companyName: company.name,
    companyStatus: "ACTIVE", role: "OWNER", enabledModules: ["*"], membershipCount: 1,
  };
  const salesSession: TenantSession = { ...base, role: "SALES" };
  // companyId+period benzersiz olmalı — gerçek verilerle asla çakışmayacak uzak bir test dönemi.
  const period = `2999-${String((Date.now() % 12) + 1).padStart(2, "0")}`;

  check("getScope: SALES + employee → YASAK", getScope(salesSession, "employee", "view") === null);
  check("getScope: OWNER + employee → serbest", getScope(base, "employee", "view") === "all");
  check("getScope: SALES + payroll → YASAK", getScope(salesSession, "payroll", "view") === null);
  check("getScope: SALES + taxObligation → YASAK", getScope(salesSession, "taxObligation", "view") === null);

  // Bordro hesap motoru — saf fonksiyon
  const calc = calculatePayrollItem(10000);
  check("calc: SGK işçi payı %14 (1400)", Math.abs(Number(calc.employeeSgkCut) - 1400) < 0.01);
  check("calc: işsizlik işçi payı %1 (100)", Math.abs(Number(calc.unemploymentCut) - 100) < 0.01);
  check("calc: net < brüt", Number(calc.netSalary) < Number(calc.grossSalary));

  let employeeId = "";
  let leaveId = "";
  let runId = "";
  let taxId = "";
  try {
    // 1) Personel CRUD
    const empRes = await createEmployee(base, {
      fullName: "__Test Personel__", nationalId: "12345678901", position: "Test Pozisyon", department: "Test Departman",
      phone: "", email: "", hireDate: new Date("2025-01-01"), terminationDate: null, sgkSicilNo: "", iban: "",
      grossSalary: 25000, status: "ACTIVE", note: "",
    });
    check("Personel oluşturuldu", empRes.ok);
    if (!empRes.ok) return;
    employeeId = empRes.data.id;

    const updRes = await updateEmployee(base, employeeId, {
      fullName: "__Test Personel__", nationalId: "12345678901", position: "Güncellenmiş Pozisyon", department: "Test Departman",
      phone: "", email: "", hireDate: new Date("2025-01-01"), terminationDate: null, sgkSicilNo: "", iban: "",
      grossSalary: 30000, status: "ACTIVE", note: "",
    });
    check("Personel güncellendi", updRes.ok);

    const getRes = await getEmployee(base, employeeId);
    check("Personel detayı: maaş güncel (30000)", getRes.ok && Number(getRes.data.grossSalary) === 30000);

    // 2) İzin kaydı
    const leaveRes = await createLeaveRequest(base, { employeeId, type: "YILLIK", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-05"), days: 5, note: "Test izni" });
    check("İzin kaydı oluşturuldu", leaveRes.ok);
    if (leaveRes.ok) leaveId = leaveRes.data.id;
    const afterLeave = await getEmployee(base, employeeId);
    check("Personel detayında izin görünüyor", afterLeave.ok && afterLeave.data.leaveRequests.length === 1);

    // 3) RLS izolasyonu: başka şirketten bu personele erişim
    const otherCompany = await withPlatformBypass((tx) => tx.company.findFirst({ where: { id: { not: company.id }, deletedAt: null } }));
    if (otherCompany) {
      const crossSession: TenantSession = { ...base, companyId: otherCompany.id };
      const crossRes = await getEmployee(crossSession, employeeId);
      check("RLS: başka şirket bu personeli göremiyor (notFound)", !crossRes.ok && crossRes.status === 404);
    }

    // 4) Bordro dönemi — yalnızca ACTIVE personel için otomatik kalem üretilmeli
    const runRes = await createPayrollRun(base, { period, note: "Test bordrosu" });
    check("Bordro dönemi oluşturuldu", runRes.ok);
    if (!runRes.ok) return;
    runId = runRes.data.id;

    const runDetail = await getPayrollRun(base, runId);
    check("Bordro kalemi ACTIVE personel için otomatik üretildi", runDetail.ok && runDetail.data.items.some((it) => it.employeeId === employeeId));
    check("Bordro toplam brüt > 0", runDetail.ok && Number(runDetail.data.totalGross) > 0);

    // 5) Kalem düzenleme — DRAFT'ta serbest
    if (runDetail.ok) {
      const item = runDetail.data.items.find((it) => it.employeeId === employeeId)!;
      const itemUpdRes = await updatePayrollRunItem(base, runId, item.id, {
        employeeId, grossSalary: 30000, employeeSgkCut: 4200, unemploymentCut: 300, incomeTax: 3800, stampTax: 227.7, employerSgkCost: 5250,
      });
      check("Bordro kalemi güncellendi", itemUpdRes.ok);
      const afterItemUpd = await getPayrollRun(base, runId);
      const updatedItem = afterItemUpd.ok ? afterItemUpd.data.items.find((it) => it.id === item.id) : null;
      check("Kalem netSalary yeniden hesaplandı (30000-4200-300-3800-227.7=21472.3)", !!updatedItem && Math.abs(Number(updatedItem.netSalary) - 21472.3) < 0.01);
      check("Dönem toplamları kalemle birlikte güncellendi", afterItemUpd.ok && Number(afterItemUpd.data.totalNet) > 0);
    }

    // 6) Tamamlama — hesap seçilmeden önce DRAFT kalır, hesapla COMPLETED olur
    const completeRes = await completePayrollRun(base, runId, account.id);
    check("Bordro tamamlandı", completeRes.ok);
    const completedDetail = await getPayrollRun(base, runId);
    check("Tamamlanan bordro status=COMPLETED", completedDetail.ok && completedDetail.data.status === "COMPLETED");

    // 7) Tamamlanmış bordroda kalem düzenlenemez, silinemez
    if (completedDetail.ok) {
      const item = completedDetail.data.items[0];
      const blockedUpd = await updatePayrollRunItem(base, runId, item.id, { employeeId: item.employeeId, grossSalary: 1, employeeSgkCut: 0, unemploymentCut: 0, incomeTax: 0, stampTax: 0, employerSgkCost: 0 });
      check("Tamamlanmış bordroda kalem düzenlenemez (409)", !blockedUpd.ok && blockedUpd.status === 409);
    }
    const blockedDelete = await deletePayrollRun(base, runId);
    check("Tamamlanmış bordro silinemez (409)", !blockedDelete.ok && blockedDelete.status === 409);

    // 8) Vergi & SGK yükümlülüğü
    const taxRes = await createTaxObligation(base, { type: "KDV", period: "2026-01", dueDate: new Date("2026-01-26"), amount: 15000, note: "Test KDV", isRecurringTemplate: false });
    check("Vergi yükümlülüğü oluşturuldu", taxRes.ok);
    if (!taxRes.ok) return;
    taxId = taxRes.data.id;

    const upcoming = await getUpcomingObligations(base, 10);
    check("Yaklaşan yükümlülükler listesinde görünüyor", upcoming.ok && upcoming.data.some((o) => o.id === taxId));

    const payRes = await payTaxObligation(base, taxId, { paidAmount: 15000, paidAt: new Date(), accountId: account.id });
    check("Yükümlülük ödendi olarak işaretlendi", payRes.ok);
    const doublePayRes = await payTaxObligation(base, taxId, { paidAmount: 15000, paidAt: new Date(), accountId: account.id });
    check("Zaten ödenmiş yükümlülük tekrar ödenemez (409)", !doublePayRes.ok && doublePayRes.status === 409);

    // 9) Lisanssız: modüller kapalıyken 403
    const noModuleSession: TenantSession = { ...base, enabledModules: [] };
    check("Lisanssız: employee modülü kapalıyken YASAK", getScope(noModuleSession, "employee", "view") === null);
    check("Lisanssız: payroll modülü kapalıyken YASAK", getScope(noModuleSession, "payroll", "view") === null);
    check("Lisanssız: taxObligation modülü kapalıyken YASAK", getScope(noModuleSession, "taxObligation", "view") === null);
  } finally {
    await withPlatformBypass(async (tx) => {
      if (taxId) await tx.taxObligation.delete({ where: { id: taxId } }).catch(() => {});
      if (runId) {
        await tx.payrollRunItem.deleteMany({ where: { payrollRunId: runId } });
        await tx.payrollRun.delete({ where: { id: runId } }).catch(() => {});
      }
      if (leaveId) await tx.leaveRequest.delete({ where: { id: leaveId } }).catch(() => {});
      await tx.auditLog.deleteMany({ where: { entityId: { in: [employeeId, leaveId, runId, taxId].filter(Boolean) } } });
      if (employeeId) await tx.employee.delete({ where: { id: employeeId } }).catch(() => {});
    });
    console.log("· test verisi temizlendi");
  }

  console.log(failures === 0 ? "\n🎉 Personel/Bordro/Vergi & SGK modülleri tüm kontrollerden geçti." : `\n${failures} KONTROL BAŞARISIZ`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
