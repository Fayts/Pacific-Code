import { z } from "zod";

// Sortie STRICTE attendue de l'analyse IA (route /api/import/parse).
// Tout écart de structure est rejeté : l'IA ne touche jamais la base.

export const aiParsedItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  categoryName: z.string().trim().max(100).default(""),
  quantity: z.number().int().min(1).max(10_000).default(1),
  tracking: z.enum(["stock", "individual"]).default("stock"),
  dailyPrice: z.number().min(0).max(99_999_999).nullable().default(null),
  /** "daily" : prix par jour ; "flat" : forfait / prestation à prix fixe. */
  pricingMode: z.enum(["daily", "flat"]).default("daily"),
  depositAmount: z.number().min(0).max(99_999_999).nullable().default(null),
  description: z.string().trim().max(5000).default(""),
  priceConfidence: z.enum(["detected", "probable", "missing"]).default("detected"),
  depositConfidence: z.enum(["detected", "probable", "missing"]).default("missing"),
});

export const aiParseResultSchema = z.object({
  items: z.array(aiParsedItemSchema).max(100),
  business: z
    .object({
      name: z.string().trim().max(200).nullable().default(null),
      phone: z.string().trim().max(50).nullable().default(null),
      email: z.string().trim().max(200).nullable().default(null),
      address: z.string().trim().max(500).nullable().default(null),
      deliveryNotes: z.string().trim().max(1000).nullable().default(null),
    })
    .default({
      name: null,
      phone: null,
      email: null,
      address: null,
      deliveryNotes: null,
    }),
});

export type AiParseResult = z.infer<typeof aiParseResultSchema>;

export const parseRequestSchema = z.object({
  text: z.string().min(1).max(20_000),
});
