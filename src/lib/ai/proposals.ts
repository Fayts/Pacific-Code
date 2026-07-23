// Propositions d'action de l'assistant IA.
// L'assistant ne modifie JAMAIS les données directement : ses outils de
// préparation renvoient une proposition structurée que l'utilisateur doit
// confirmer dans l'interface. La confirmation déclenche les server actions
// habituelles (createBooking, createCustomer, setEquipmentStatus), qui
// revalident tout côté serveur.

import { z } from "zod";
import { bookingSchema } from "@/lib/validations/booking";
import { customerSchema } from "@/lib/validations/customer";
import { equipmentStatusChangeSchema } from "@/lib/validations/equipment";

export const bookingProposalSchema = z.object({
  kind: z.literal("booking_proposal"),
  payload: bookingSchema,
  summary: z.object({
    customerName: z.string(),
    items: z.array(
      z.object({
        equipmentName: z.string(),
        quantity: z.number(),
        dailyPrice: z.number(),
        pricingMode: z.enum(["daily", "flat"]).optional(),
      })
    ),
    startAt: z.string(),
    endAt: z.string(),
    durationDays: z.number(),
    total: z.number(),
    deposit: z.number(),
    currency: z.string(),
    warnings: z.array(z.string()).default([]),
  }),
});

export const customerProposalSchema = z.object({
  kind: z.literal("customer_proposal"),
  payload: customerSchema,
  summary: z.object({
    displayName: z.string(),
  }),
});

export const equipmentStatusProposalSchema = z.object({
  kind: z.literal("equipment_status_proposal"),
  payload: equipmentStatusChangeSchema,
  summary: z.object({
    equipmentName: z.string(),
    statusLabel: z.string(),
  }),
});

export const proposalSchema = z.discriminatedUnion("kind", [
  bookingProposalSchema,
  customerProposalSchema,
  equipmentStatusProposalSchema,
]);

export type BookingProposal = z.infer<typeof bookingProposalSchema>;
export type CustomerProposal = z.infer<typeof customerProposalSchema>;
export type EquipmentStatusProposal = z.infer<
  typeof equipmentStatusProposalSchema
>;
export type AssistantProposal = z.infer<typeof proposalSchema>;

/** Réponse du endpoint /api/assistant/chat. */
export type AssistantChatResponse = {
  conversationId: string;
  text: string;
  proposals: AssistantProposal[];
};
