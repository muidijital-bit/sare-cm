import { NextRequest, NextResponse } from "next/server";
import { requireSession, isSession } from "@/lib/api/handlers";
import { exportPayments } from "@/lib/modules/payments/service";
import { listPaymentsQuerySchema } from "@/lib/validation/payment";
import { toCsv, csvResponseHeaders } from "@/lib/export/csv";
import { tr, formatDateTR } from "@/lib/i18n/tr";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!isSession(session)) return session;

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = listPaymentsQuerySchema.safeParse({ ...searchParams, page: 1, pageSize: 1 });
  const { q, customerId, method } = parsed.success ? parsed.data : {};

  const result = await exportPayments(session, { q, customerId, method });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });

  const csv = toCsv(result.data, [
    { header: "Tarih", value: (r) => formatDateTR(new Date(r.paidAt)) },
    { header: "Müşteri", value: (r) => r.customerTitle },
    { header: "Yöntem", value: (r) => tr.payment.method[r.method as keyof typeof tr.payment.method] ?? r.method },
    { header: "Hesap", value: (r) => r.accountName },
    { header: "Tutar (TL)", value: (r) => r.amount.toFixed(2).replace(".", ",") },
    { header: "Durum", value: (r) => (r.isCancelled ? "İptal edildi" : "Aktif") },
    { header: "Referans", value: (r) => r.reference },
    { header: "Not", value: (r) => r.note },
  ]);

  return new NextResponse(csv, { headers: csvResponseHeaders(`tahsilatlar-${Date.now()}.csv`) });
}
