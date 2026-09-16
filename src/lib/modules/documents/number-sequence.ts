import type { Prisma } from "@prisma/client";

/**
 * SA-03/TK-11: şirket bazında ardışık ve boşluksuz belge numarası üretimi.
 *
 * Yarışa açık `SELECT MAX(number)` yerine, `document_sequences` üzerinde atomik bir
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` kullanılır: bu tek SQL ifadesi
 * Postgres'te satır kilidini örtük olarak alır, eşzamanlı iki isteğin aynı numarayı
 * almasını imkansız kılar (ikinci istek birincinin commit/rollback'ini bekler).
 *
 * `tx` MUTLAKA `withTenant()` ile açılmış bir transaction client'ı olmalıdır — hem RLS
 * bağlamının doğru kurulması hem de belge oluşturma ile numara üretiminin aynı
 * transaction'da atomik olması için (numara üretilip belge kaydı başarısız olursa
 * numara da geri alınır, boşluk oluşmaz).
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  docType: "QUOTE" | "ORDER",
  format: string,
): Promise<string> {
  const year = new Date().getFullYear();

  const rows = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO document_sequences (id, company_id, doc_type, year, last_number)
    VALUES (gen_random_uuid(), ${companyId}::uuid, ${docType}::"DocumentType", ${year}, 1)
    ON CONFLICT (company_id, doc_type, year)
    DO UPDATE SET last_number = document_sequences.last_number + 1
    RETURNING last_number
  `;

  const sequence = rows[0].last_number;
  return format.replace("{yil}", String(year)).replace("{sira}", String(sequence).padStart(4, "0"));
}
