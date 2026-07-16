import { z } from "zod";

const timezoneSchema = z
  .string()
  .trim()
  .min(1, "Fuseau horaire requis")
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Fuseau horaire inconnu" }
  );

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Nom commercial requis").max(200),
  businessType: z.enum(["equipment", "vehicles", "nautical", "events", "other"]),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Code devise à 3 lettres (ex. XPF)"),
  timezone: timezoneSchema,
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  bookingPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, "2 à 6 lettres ou chiffres (ex. PRC)"),
});

export const organizationSettingsSchema = onboardingSchema.extend({
  email: z
    .string()
    .trim()
    .email("Adresse email invalide")
    .optional()
    .or(z.literal("")),
  dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type OrganizationSettingsInput = z.infer<
  typeof organizationSettingsSchema
>;
