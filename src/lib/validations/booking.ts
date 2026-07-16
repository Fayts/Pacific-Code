import { z } from "zod";

// Les dates transitent en "datetime-local" ("2026-07-16T08:00").
// La conversion vers UTC se fait côté serveur avec le fuseau de l'organisation.
export const localDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/,
    "Format de date invalide"
  );

export const bookingItemInputSchema = z.object({
  equipmentId: z.string().uuid("Matériel invalide"),
  quantity: z.coerce.number().int().min(1, "Quantité minimale : 1").max(1000),
});

export const bookingSchema = z
  .object({
    customerId: z.string().uuid("Client requis"),
    items: z
      .array(bookingItemInputSchema)
      .min(1, "Sélectionnez au moins un matériel"),
    startAt: localDateTimeSchema,
    endAt: localDateTimeSchema,
    discountAmount: z.coerce.number().min(0).max(99_999_999).default(0),
    extraFeesAmount: z.coerce.number().min(0).max(99_999_999).default(0),
    depositAmount: z.coerce.number().min(0).max(99_999_999).default(0),
    notes: z.string().trim().max(10_000).optional().or(z.literal("")),
    status: z.enum(["draft", "pending", "confirmed"]).default("draft"),
  })
  .superRefine((data, ctx) => {
    if (data.endAt <= data.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "Le retour doit être après le départ",
      });
    }
    const ids = data.items.map((i) => i.equipmentId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Un même matériel ne peut apparaître qu'une fois",
      });
    }
  });

export const bookingStatusChangeSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum([
    "draft",
    "pending",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
  ]),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const paymentStatusChangeSchema = z.object({
  bookingId: z.string().uuid(),
  paymentStatus: z.enum(["unpaid", "deposit_paid", "paid", "refunded"]),
});

export const depositStatusChangeSchema = z.object({
  bookingId: z.string().uuid(),
  depositStatus: z.enum([
    "not_required",
    "pending",
    "received",
    "returned",
    "partially_withheld",
    "withheld",
  ]),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type BookingItemInput = z.infer<typeof bookingItemInputSchema>;
export type BookingStatusChangeInput = z.infer<
  typeof bookingStatusChangeSchema
>;
