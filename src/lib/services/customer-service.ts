// Service Clients — validation et règles métier côté client :
// les composants n'appellent jamais le repository directement pour
// écrire. Le repository sous-jacent (mock aujourd'hui, Supabase demain)
// ne fait que persister.

import { getDataProvider } from "@/lib/data";
import type { CustomerDraft, DataProvider } from "@/lib/data/repositories";
import {
  customerSchema,
  type CustomerInput,
} from "@/lib/validations/customer";
import {
  actionError,
  actionOk,
  zodError,
  type ActionResult,
} from "@/server/action-result";

function toDraft(values: CustomerInput): CustomerDraft {
  return {
    type: values.type,
    firstName: values.firstName ?? "",
    lastName: values.lastName ?? "",
    companyName: values.companyName ?? "",
    email: values.email ?? "",
    phone: values.phone ?? "",
    address: values.address ?? "",
    idNumber: values.idNumber ?? "",
    internalNotes: values.internalNotes ?? "",
  };
}

export async function createCustomer(
  input: CustomerInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ customerId: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const customer = await provider.customers.create(toDraft(parsed.data));
  return actionOk({ customerId: customer.id });
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<{ customerId: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const customer = await provider.customers.update(id, toDraft(parsed.data));
  if (!customer) return actionError("Client introuvable");
  return actionOk({ customerId: customer.id });
}

export async function archiveCustomer(
  id: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const result = await provider.customers.archive(id);
  if (!result.ok) {
    return actionError(result.error ?? "Impossible d'archiver ce client");
  }
  return actionOk(undefined);
}

export async function unarchiveCustomer(
  id: string,
  provider: DataProvider = getDataProvider()
): Promise<ActionResult<undefined>> {
  const customer = await provider.customers.get(id);
  if (!customer) return actionError("Client introuvable");

  await provider.customers.unarchive(id);
  return actionOk(undefined);
}
