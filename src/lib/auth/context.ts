import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, Organization, Profile } from "@/lib/types/database";

export type OrgContext = {
  userId: string;
  email: string;
  profile: Profile | null;
  organization: Organization;
  role: MemberRole;
};

// Contexte de l'utilisateur courant : profil + première organisation.
// `cache` déduplique l'appel au sein d'un même rendu serveur.
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const [{ data: organization }, { data: profile }] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("id", membership.organization_id)
      .single(),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);

  if (!organization) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    profile: profile ?? null,
    organization,
    role: membership.role,
  };
});

/** Pour les pages du groupe (app) : session + organisation obligatoires. */
export async function requireOrgContext(): Promise<OrgContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const context = await getOrgContext();
  if (!context) redirect("/onboarding");
  return context;
}

/** Pour les server actions : jette une erreur au lieu de rediriger. */
export async function requireOrgContextForAction(): Promise<OrgContext> {
  const context = await getOrgContext();
  if (!context) {
    throw new Error("Session ou organisation introuvable");
  }
  return context;
}
