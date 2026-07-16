"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import {
  actionError,
  actionOk,
  zodError,
  type ActionResult,
} from "@/server/action-result";

async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function signIn(
  input: unknown
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "invalid_credentials") {
      return actionError("Email ou mot de passe incorrect");
    }
    if (error.code === "email_not_confirmed") {
      return actionError(
        "Adresse email non confirmée. Vérifiez votre boîte de réception."
      );
    }
    return actionError("Connexion impossible : " + error.message);
  }

  return actionOk({ redirectTo: "/dashboard" });
}

export async function signUp(
  input: unknown
): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const base = await siteUrl();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${base}/auth/callback?next=/onboarding`,
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        company_name: parsed.data.companyName,
        business_type: parsed.data.businessType,
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return actionError("Un compte existe déjà avec cette adresse email");
    }
    if (error.code === "weak_password") {
      return actionError("Mot de passe trop faible (8 caractères minimum)");
    }
    return actionError("Inscription impossible : " + error.message);
  }

  // Session présente = confirmation email désactivée : on continue direct.
  return actionOk({ needsEmailConfirmation: !data.session });
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function sendPasswordReset(
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const base = await siteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${base}/auth/callback?next=/reset-password` }
  );

  if (error) {
    return actionError("Envoi impossible : " + error.message);
  }
  return actionOk(undefined);
}

export async function updatePassword(
  input: unknown
): Promise<ActionResult<undefined>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "same_password") {
      return actionError(
        "Le nouveau mot de passe doit être différent de l'ancien"
      );
    }
    return actionError("Mise à jour impossible : " + error.message);
  }
  return actionOk(undefined);
}
