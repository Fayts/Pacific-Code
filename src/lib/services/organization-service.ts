// Service Organisation — validation des paramètres de l'entreprise.
// Le repository sous-jacent (mock aujourd'hui, Supabase demain) ne fait
// que persister.

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
