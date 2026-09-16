import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  entityType: z.string().trim().max(50).optional(),
  entityId: z.string().uuid().optional(),
  action: z.enum(["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "LOGIN_FAILED", "ROLE_CHANGE", "USER_INVITE", "USER_DEACTIVATE", "EXPORT", "SUPERADMIN_ACCESS"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
