import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;

/**
 * V1 BORDRO SABİTLERİ — basitleştirilmiş YAKLAŞIK oranlardır, güncel mevzuatı birebir
 * yansıtmayabilir (gelir vergisi özellikle KÜMÜLATİF dilim yerine tek sabit oranla hesaplanır).
 * Bu modül yalnızca bir ÖN HESAPLAMA/taslak üretir — bordro kalemi kaydedilmeden önce admin
 * her tutarı serbestçe düzenleyebilir (bkz. validation/payroll.ts, şema önerilen değil
 * ONAYLANAN değerleri kabul eder). GERÇEK bordro için muhasebecinizle doğrulayın.
 */
export const PAYROLL_RATES_V1 = {
  employeeSgkRate: 14, // SGK işçi payı %
  employeeUnemploymentRate: 1, // İşsizlik sigortası işçi payı %
  employerSgkRate: 15.5, // SGK işveren payı % (teşvikli asgari oran varsayımı — V1 tahmini)
  employerUnemploymentRate: 2, // İşsizlik sigortası işveren payı %
  incomeTaxRate: 15, // Gelir vergisi % (basitleştirilmiş TEK dilim — kümülatif dilim hesaplanmaz)
  stampTaxRate: 0.759, // Damga vergisi ‰7,59 = %0,759
};

export interface PayrollCalcResult {
  grossSalary: Prisma.Decimal;
  employeeSgkCut: Prisma.Decimal;
  unemploymentCut: Prisma.Decimal;
  incomeTax: Prisma.Decimal;
  stampTax: Prisma.Decimal;
  employerSgkCost: Prisma.Decimal;
  netSalary: Prisma.Decimal;
}

export function calculatePayrollItem(grossSalary: number | Prisma.Decimal): PayrollCalcResult {
  const gross = grossSalary instanceof Decimal ? grossSalary : new Decimal(grossSalary);
  const employeeSgkCut = gross.times(PAYROLL_RATES_V1.employeeSgkRate).dividedBy(100).toDecimalPlaces(2);
  const unemploymentCut = gross.times(PAYROLL_RATES_V1.employeeUnemploymentRate).dividedBy(100).toDecimalPlaces(2);
  const employerSgkCost = gross
    .times(PAYROLL_RATES_V1.employerSgkRate + PAYROLL_RATES_V1.employerUnemploymentRate)
    .dividedBy(100)
    .toDecimalPlaces(2);
  const taxBase = gross.minus(employeeSgkCut).minus(unemploymentCut);
  const incomeTax = taxBase.times(PAYROLL_RATES_V1.incomeTaxRate).dividedBy(100).toDecimalPlaces(2);
  const stampTax = gross.times(PAYROLL_RATES_V1.stampTaxRate).dividedBy(100).toDecimalPlaces(2);
  const netSalary = gross.minus(employeeSgkCut).minus(unemploymentCut).minus(incomeTax).minus(stampTax);
  return { grossSalary: gross, employeeSgkCut, unemploymentCut, incomeTax, stampTax, employerSgkCost, netSalary };
}
