"use client";

// Mot de passe oublié. Mode réel : envoi de l'email de réinitialisation
// (lien vers /reset-password). Mode démonstration : aucune notion de mot
// de passe, simple rappel.

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Info, MailCheck } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (provider.kind === "mock" || !provider.auth.requestPasswordReset) {
    return (
      <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-600/25">
            <Info className="size-6" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Version de démonstration</h2>
          <p className="max-w-sm text-sm text-neutral-600">
            Aucun email n&apos;est envoyé dans cette version : les comptes sont
            simulés. Connectez-vous simplement avec n&apos;importe quel email et
            mot de passe.
          </p>
          <Link href="/login" className="text-sm text-sky-700 hover:underline">
            Retour à la connexion
          </Link>
        </CardContent>
      </Card>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await provider.auth.requestPasswordReset!(
          trimmed,
          `${window.location.origin}/reset-password`
        );
        setSent(true);
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Envoi impossible, réessayez."
        );
      }
    });
  };

  return (
    <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
      {sent ? (
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <MailCheck className="size-6" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Email envoyé</h2>
          <p className="max-w-sm text-sm text-neutral-600">
            Si un compte existe pour <strong>{email.trim()}</strong>, un lien de
            réinitialisation vient d&apos;être envoyé. Ouvrez-le puis choisissez
            votre nouveau mot de passe.
          </p>
          <Link href="/login" className="text-sm text-sky-700 hover:underline">
            Retour à la connexion
          </Link>
        </CardContent>
      ) : (
        <>
          <CardHeader>
            <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
            <CardDescription>
              Indiquez votre adresse email : nous vous envoyons un lien pour
              choisir un nouveau mot de passe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@entreprise.pf"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={pending || !email.trim()}
              >
                {pending ? "Envoi…" : "Envoyer le lien de réinitialisation"}
              </Button>
              <p className="text-center text-sm">
                <Link href="/login" className="text-sky-700 hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </form>
          </CardContent>
        </>
      )}
    </Card>
  );
}
