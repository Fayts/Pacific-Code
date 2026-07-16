"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContextForAction } from "@/lib/auth/context";
import { customerSchema } from "@/lib/validations/customer";
import {
  actionError,
  actionOk,
  zodError,
  type ActionResult,
} from "@/server/action-result";
import { logActivity } from "@/server/activity";

function revalidateCustomers(id?: string) {
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/customers/${id}`);
}

export async function createCustomer(
  input: unknown
): Promise<ActionResult<{ customerId: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: context.organization.id,
      type: parsed.data.type,
      first_name: parsed.data.firstName || "",
      last_name: parsed.data.lastName || "",
      company_name: parsed.data.companyName || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      id_number: parsed.data.idNumber || null,
      internal_notes: parsed.data.internalNotes || null,
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError("Création du client impossible : " + error?.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "customer.created",
    entityType: "customer",
    entityId: data.id,
  });

  revalidateCustomers(data.id);
  return actionOk({ customerId: data.id });
}

export async function updateCustomer(
  customerId: string,
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      type: parsed.data.type,
      first_name: parsed.data.firstName || "",
      last_name: parsed.data.lastName || "",
      company_name: parsed.data.companyName || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      id_number: parsed.data.idNumber || null,
      internal_notes: parsed.data.internalNotes || null,
    })
    .eq("id", customerId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Mise à jour impossible : " + error.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "customer.updated",
    entityType: "customer",
    entityId: customerId,
  });

  revalidateCustomers(customerId);
  return actionOk(undefined);
}

export async function archiveCustomer(
  customerId: string
): Promise<ActionResult<undefined>> {
  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  // Refuse l'archivage si le client a des réservations actives.
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("organization_id", context.organization.id)
    .in("status", ["pending", "confirmed", "in_progress"]);

  if ((count ?? 0) > 0) {
    return actionError(
      "Impossible d'archiver : ce client a des réservations actives"
    );
  }

  const { error } = await supabase
    .from("customers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Archivage impossible : " + error.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "customer.archived",
    entityType: "customer",
    entityId: customerId,
  });

  revalidateCustomers(customerId);
  return actionOk(undefined);
}

export async function unarchiveCustomer(
  customerId: string
): Promise<ActionResult<undefined>> {
  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ archived_at: null })
    .eq("id", customerId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Restauration impossible : " + error.message);
  }

  revalidateCustomers(customerId);
  return actionOk(undefined);
}
