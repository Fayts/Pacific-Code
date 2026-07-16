import { z } from "zod";

export const customerSchema = z
  .object({
    type: z.enum(["individual", "company"]),
    firstName: z.string().trim().max(100).optional().or(z.literal("")),
    lastName: z.string().trim().max(100).optional().or(z.literal("")),
    companyName: z.string().trim().max(200).optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Adresse email invalide")
      .optional()
      .or(z.literal("")),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    idNumber: z.string().trim().max(100).optional().or(z.literal("")),
    internalNotes: z.string().trim().max(10_000).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.type === "individual" && !data.lastName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastName"],
        message: "Nom requis pour un particulier",
      });
    }
    if (data.type === "company" && !data.companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyName"],
        message: "Nom de société requis pour un professionnel",
      });
    }
  });

export type CustomerInput = z.infer<typeof customerSchema>;
