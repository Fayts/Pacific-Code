"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContextForAction } from "@/lib/auth/context";
import {
  categorySchema,
  equipmentSchema,
  equipmentStatusChangeSchema,
} from "@/lib/validations/equipment";
import {
  actionError,
  actionOk,
  zodError,
  type ActionResult,
} from "@/server/action-result";
import { logActivity } from "@/server/activity";

function revalidateEquipment(id?: string) {
  revalidatePath("/equipment");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/equipment/${id}`);
}

export async function createEquipment(
  input: unknown
): Promise<ActionResult<{ equipmentId: string }>> {
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("equipment_items")
    .insert({
      organization_id: context.organization.id,
      category_id: parsed.data.categoryId ?? null,
      name: parsed.data.name,
      internal_ref: parsed.data.internalRef || null,
      description: parsed.data.description || null,
      daily_price: parsed.data.dailyPrice,
      deposit_amount: parsed.data.depositAmount,
      quantity_total: parsed.data.quantityTotal,
      min_rental_days: parsed.data.minRentalDays,
      status: parsed.data.status,
      usage_instructions: parsed.data.usageInstructions || null,
      internal_notes: parsed.data.internalNotes || null,
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError("Création du matériel impossible : " + error?.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "equipment.created",
    entityType: "equipment_item",
    entityId: data.id,
    metadata: { name: parsed.data.name },
  });

  revalidateEquipment(data.id);
  return actionOk({ equipmentId: data.id });
}

export async function updateEquipment(
  equipmentId: string,
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("equipment_items")
    .update({
      category_id: parsed.data.categoryId ?? null,
      name: parsed.data.name,
      internal_ref: parsed.data.internalRef || null,
      description: parsed.data.description || null,
      daily_price: parsed.data.dailyPrice,
      deposit_amount: parsed.data.depositAmount,
      quantity_total: parsed.data.quantityTotal,
      min_rental_days: parsed.data.minRentalDays,
      status: parsed.data.status,
      usage_instructions: parsed.data.usageInstructions || null,
      internal_notes: parsed.data.internalNotes || null,
    })
    .eq("id", equipmentId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Mise à jour impossible : " + error.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "equipment.updated",
    entityType: "equipment_item",
    entityId: equipmentId,
  });

  revalidateEquipment(equipmentId);
  return actionOk(undefined);
}

export async function setEquipmentStatus(
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = equipmentStatusChangeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("equipment_items")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.equipmentId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Changement de statut impossible : " + error.message);
  }

  // Passage en maintenance : trace dans l'historique de maintenance.
  if (parsed.data.status === "maintenance") {
    await supabase.from("maintenance_records").insert({
      organization_id: context.organization.id,
      equipment_id: parsed.data.equipmentId,
      description: parsed.data.note || "Mise en maintenance",
      created_by: context.userId,
    });
  } else {
    // Sortie de maintenance : clôt l'épisode ouvert le plus récent.
    const { data: open } = await supabase
      .from("maintenance_records")
      .select("id")
      .eq("equipment_id", parsed.data.equipmentId)
      .eq("organization_id", context.organization.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open) {
      await supabase
        .from("maintenance_records")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", open.id);
    }
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "equipment.status_changed",
    entityType: "equipment_item",
    entityId: parsed.data.equipmentId,
    metadata: { status: parsed.data.status, note: parsed.data.note || null },
  });

  revalidateEquipment(parsed.data.equipmentId);
  return actionOk(undefined);
}

export async function archiveEquipment(
  equipmentId: string
): Promise<ActionResult<undefined>> {
  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  // Refuse l'archivage si une réservation active utilise ce matériel.
  const { count } = await supabase
    .from("booking_items")
    .select("id, bookings!inner(status)", { count: "exact", head: true })
    .eq("equipment_id", equipmentId)
    .eq("organization_id", context.organization.id)
    .in("bookings.status", ["pending", "confirmed", "in_progress"]);

  if ((count ?? 0) > 0) {
    return actionError(
      "Impossible d'archiver : des réservations actives utilisent ce matériel"
    );
  }

  const { error } = await supabase
    .from("equipment_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", equipmentId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Archivage impossible : " + error.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "equipment.archived",
    entityType: "equipment_item",
    entityId: equipmentId,
  });

  revalidateEquipment(equipmentId);
  return actionOk(undefined);
}

export async function unarchiveEquipment(
  equipmentId: string
): Promise<ActionResult<undefined>> {
  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { error } = await supabase
    .from("equipment_items")
    .update({ archived_at: null })
    .eq("id", equipmentId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Restauration impossible : " + error.message);
  }

  revalidateEquipment(equipmentId);
  return actionOk(undefined);
}

export async function duplicateEquipment(
  equipmentId: string
): Promise<ActionResult<{ equipmentId: string }>> {
  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { data: source } = await supabase
    .from("equipment_items")
    .select("*")
    .eq("id", equipmentId)
    .eq("organization_id", context.organization.id)
    .single();

  if (!source) {
    return actionError("Matériel introuvable");
  }

  const { data, error } = await supabase
    .from("equipment_items")
    .insert({
      organization_id: context.organization.id,
      category_id: source.category_id,
      name: `${source.name} (copie)`,
      internal_ref: null,
      description: source.description,
      daily_price: source.daily_price,
      deposit_amount: source.deposit_amount,
      quantity_total: source.quantity_total,
      min_rental_days: source.min_rental_days,
      status: "available",
      usage_instructions: source.usage_instructions,
      internal_notes: source.internal_notes,
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError("Duplication impossible");
  }

  revalidateEquipment(data.id);
  return actionOk({ equipmentId: data.id });
}

// ============================================================
// Catégories
// ============================================================

export async function createCategory(
  input: unknown
): Promise<ActionResult<{ categoryId: string }>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("equipment_categories")
    .insert({
      organization_id: context.organization.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return actionError("Une catégorie porte déjà ce nom");
    }
    return actionError("Création de la catégorie impossible");
  }

  revalidateEquipment();
  return actionOk({ categoryId: data.id });
}

export async function deleteCategory(
  categoryId: string
): Promise<ActionResult<undefined>> {
  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  // Les matériels rattachés passent en "sans catégorie" (FK on delete set null).
  const { error } = await supabase
    .from("equipment_categories")
    .delete()
    .eq("id", categoryId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return actionError("Suppression impossible : " + error.message);
  }

  revalidateEquipment();
  return actionOk(undefined);
}

// ============================================================
// Photos
// ============================================================

export async function addEquipmentImage(
  formData: FormData
): Promise<ActionResult<{ imageId: string }>> {
  const context = await requireOrgContextForAction();

  const equipmentId = formData.get("equipmentId");
  const file = formData.get("image");
  const isPrimary = formData.get("isPrimary") === "true";

  if (typeof equipmentId !== "string" || !equipmentId) {
    return actionError("Matériel manquant");
  }
  if (!(file instanceof File) || file.size === 0) {
    return actionError("Aucun fichier reçu");
  }
  if (file.size > 5 * 1024 * 1024) {
    return actionError("Photo trop volumineuse (5 Mo maximum)");
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return actionError("Format accepté : PNG, JPG ou WebP");
  }

  const supabase = await createClient();

  // Vérifie que le matériel appartient bien à l'organisation.
  const { data: item } = await supabase
    .from("equipment_items")
    .select("id")
    .eq("id", equipmentId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (!item) {
    return actionError("Matériel introuvable");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${context.organization.id}/${equipmentId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("equipment-images")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return actionError("Téléversement impossible : " + uploadError.message);
  }

  if (isPrimary) {
    await supabase
      .from("equipment_images")
      .update({ is_primary: false })
      .eq("equipment_id", equipmentId)
      .eq("organization_id", context.organization.id);
  }

  const { data, error } = await supabase
    .from("equipment_images")
    .insert({
      organization_id: context.organization.id,
      equipment_id: equipmentId,
      storage_path: path,
      is_primary: isPrimary,
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError("Enregistrement de la photo impossible");
  }

  revalidateEquipment(equipmentId);
  return actionOk({ imageId: data.id });
}

export async function deleteEquipmentImage(
  imageId: string
): Promise<ActionResult<undefined>> {
  const context = await requireOrgContextForAction();
  const supabase = await createClient();

  const { data: image } = await supabase
    .from("equipment_images")
    .select("id, storage_path, equipment_id")
    .eq("id", imageId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!image) {
    return actionError("Photo introuvable");
  }

  await supabase.storage.from("equipment-images").remove([image.storage_path]);

  const { error } = await supabase
    .from("equipment_images")
    .delete()
    .eq("id", imageId);

  if (error) {
    return actionError("Suppression impossible");
  }

  revalidateEquipment(image.equipment_id);
  return actionOk(undefined);
}
