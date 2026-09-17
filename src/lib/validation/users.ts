import { z } from "zod";

const roleSchema = z.enum(["OWNER", "ADMIN", "SALES", "ACCOUNTING", "VIEWER"]);

/** KY-04: kullanıcı davet akışı. */
export const inviteUserInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  role: roleSchema,
});
export type InviteUserInput = z.infer<typeof inviteUserInputSchema>;

export const updateMembershipInputSchema = z.object({
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMembershipInput = z.infer<typeof updateMembershipInputSchema>;

export const acceptInvitationInputSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, "Ad soyad zorunlu").max(200),
  password: z.string().min(1),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;
