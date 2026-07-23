// Service Organisation — validation des paramètres de l'entreprise.
// Le repository sous-jacent (mock aujourd'hui, Supabase demain) ne fait
// que persister.

import { z } from "zod";
import { getDataProvider } from "@/lib/data";
import type { DataProvider } from "@/lib/data/repositories";
import {
  organizationSettingsSchema,
  type OrganizationSettingsInput,
} from "@/lib/validations/organization";
import {
  actionOk,
  zodError,
  type ActionResult,
} from "@/server/action-result";

const storefrontSettingsSchema = z.object({
  welcome: z.string().trim().max(600, "600 caractères maximum"),
  visible: z.boolean(),
});

export type StorefrontSettingsInput = z.infer<typeof storefrontSettingsSchema>;

/** Personnalisation de la vitrine publique (texte d'accueil, visibilité). */
export async function updateStorefrontSettings(
  input: StorefrontSettingsInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const parsed = storefrontSettingsSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  await provider.organization.update({
    storefront_welcome: parsed.data.welcome || null,
    storefront_visible: parsed.data.visible,
  });
  return actionOk(undefined);
}

export async function updateOrganizationSettings(
  input: OrganizationSettingsInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const v = parsed.data;

  await provider.organization.update({
    name: v.name,
    business_type: v.businessType,
    currency: v.currency,
    timezone: v.timezone,
    phone: v.phone || null,
    email: v.email || null,
    address: v.address || null,
    booking_prefix: v.bookingPrefix,
    date_format: v.dateFormat,
  });
  return actionOk(undefined);
}
