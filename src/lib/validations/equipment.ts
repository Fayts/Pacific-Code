import { z } from "zod";

export const equipmentSchema = z.object({
  name: z.string().trim().min(1, "Nom du matériel requis").max(200),
  categoryId: z.string().uuid().nullable().optional(),
  internalRef: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  dailyPrice: z.coerce
    .number()
    .min(0, "Le prix journalier ne peut pas être négatif")
    .max(99_999_999),
  depositAmount: z.coerce
    .number()
    .min(0, "La caution ne peut pas être négative")
    .max(99_999_999),
  quantityTotal: z.coerce
    .number()
    .int("Quantité entière requise")
    .min(1, "Au moins un exemplaire")
    .max(10_000),
  minRentalDays: z.coerce
    .number()
    .int()
    .min(1, "Minimum 1 jour")
    .max(365),
  status: z.enum(["available", "maintenance", "unavailable"]),
  usageInstructions: z.string().trim().max(10_000).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(10_000).optional().or(z.literal("")),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nom de catégorie requis").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const equipmentStatusChangeSchema = z.object({
  equipmentId: z.string().uuid(),
  status: z.enum(["available", "maintenance", "unavailable"]),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type EquipmentStatusChangeInput = z.infer<
  typeof equipmentStatusChangeSchema
>;
