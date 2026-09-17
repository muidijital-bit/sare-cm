import { z } from "zod";

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "En az bir kayıt seçin").max(500, "Tek seferde en fazla 500 kayıt işlenebilir"),
});

export const bulkIdsWithReasonSchema = bulkIdsSchema.extend({
  reason: z.string().trim().min(1, "İptal gerekçesi zorunlu").max(500),
});
