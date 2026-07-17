"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getOrgContext,
  requireOrgContextForAction,
} from "@/lib/auth/context";
import {
  onboardingSchema,
  organizationSettingsSchema,
} from "@/lib/validations/organization";
import {
  actionError,
  actionOk,
  toUserMessage,
  zodError,
  type ActionResult,
} from "@/server/action-result";
import { logActivity } from "@/server/activity";

// Onboarding : crée l'organisation (via RPC SECURITY DEFINER qui insère
// aussi le membre owner), puis complète les informations.
export async function completeOnboarding(
  input: unknown
): Promise<ActionResult<{ organizationId: string }>> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return actionError("Session expirée, reconnectez-vous");

  // Un utilisateur qui a déjà une organisation ne repasse pas par l'onboarding.
  const existing = await getOrgContext();
  if (existing) {
    return actionOk({ organizationId: existing.organization.id });
  }

  const { data: orgId, error: rpcError } = await supabase.rpc(
    "create_organization_with_owner",
    {
      p_name: parsed.data.name,
      p_business_type: parsed.data.businessType,
      p_booking_prefix: parsed.data.bookingPrefix,
    }
  );

  if (rpcError || !orgId) {
    return actionError(
      toUserMessage(rpcError, "Création de l'entreprise impossible")
    );
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (updateError) {
    return actionError("Enregistrement des paramètres impossible");
  }

  await logActivity(supabase, {
    organizationId: orgId,
    userId: user.id,
    action: "organization.created",
    entityType: "organization",
    entityId: orgId,
    metadata: { name: parsed.data.name },
  });

  revalidatePath("/", "layout");
  return actionOk({ organizationId: orgId });
}

export async function updateOrganizationSettings(
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const context = await requireOrgContextForAction();
  if (context.role === "member") {
    return actionError("Seul un administrateur peut modifier les paramètres");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      business_type: parsed.data.businessType,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
      date_format: parsed.data.dateFormat,
      booking_prefix: parsed.data.bookingPrefix,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
    })
    .eq("id", context.organization.id);

  if (error) {
    return actionError("Enregistrement impossible : " + error.message);
  }

  await logActivity(supabase, {
    organizationId: context.organization.id,
    userId: context.userId,
    action: "organization.settings_updated",
    entityType: "organization",
    entityId: context.organization.id,
  });

  revalidatePath("/", "layout");
  return actionOk(undefined);
}

// Le logo transite par FormData (fichier binaire).
export async function updateOrganizationLogo(
  formData: FormData
): Promise<ActionResult<{ logoUrl: string }>> {
  const context = await requireOrgContextForAction();
  if (context.role === "member") {
    return actionError("Seul un administrateur peut modifier le logo");
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return actionError("Aucun fichier reçu");
  }
  if (file.size > 2 * 1024 * 1024) {
    return actionError("Logo trop volumineux (2 Mo maximum)");
  }
  // Pas de SVG : servi depuis un bucket public, un SVG peut embarquer du
  // script (XSS). L'extension vient du type MIME validé, pas du nom de fichier.
  const LOGO_EXTENSIONS: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const ext = LOGO_EXTENSIONS[file.type];
  if (!ext) {
    return actionError("Format accepté : PNG, JPG ou WebP");
  }

  const supabase = await createClient();
  const path = `${context.organization.id}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return actionError("Téléversement impossible : " + uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(path);

  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: publicUrl })
    .eq("id", context.organization.id);

  if (error) {
    return actionError("Enregistrement du logo impossible");
  }

  revalidatePath("/", "layout");
  return actionOk({ logoUrl: publicUrl });
}
