import { NextRequest, NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { exportExpenses } from "@/lib/modules/expenses/service";
import { listExpensesQuerySchema } from "@/lib/validation/expense";
import { toCsv, csvResponseHeaders } from "@/lib/export/csv";
import { tr, formatDateTR } from "@/lib/i18n/tr";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = listExpensesQuerySchema.safeParse({ ...searchParams, page: 1, pageSize: 1 });
  const { q, categoryId, dateFrom, dateTo } = parsed.success ? parsed.data : {};

  const result = await exportExpenses(session, { q, categoryId, dateFrom, dateTo });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });

  const csv = toCsv(result.data, [
    { header: "Tarih", value: (r) => formatDateTR(new Date(r.spentAt)) },
    { header: "Kategori", value: (r) => r.categoryName },
    { header: "Tedarikçi/Açıklama", value: (r) => r.vendor },
    { header: "Ödeme Yöntemi", value: (r) => (r.method ? tr.payment.method[r.method as keyof typeof tr.payment.method] ?? r.method : "") },
    { header: "Tutar (TL)", value: (r) => r.amount.toFixed(2).replace(".", ",") },
    { header: "KDV (TL)", value: (r) => r.vatAmount.toFixed(2).replace(".", ",") },
    { header: "Not", value: (r) => r.note },
  ]);

  return new NextResponse(csv, { headers: csvResponseHeaders(`giderler-${Date.now()}.csv`) });
}
