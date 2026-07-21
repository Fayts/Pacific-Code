"use client";

// Choix d'un nouveau mot de passe. Mode réel : fonctionne avec la session
// ouverte par le lien de réinitialisation (ou une session normale — la
// page sert aussi à changer son mot de passe). Mode démo : notice.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, KeyRound } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

export default function ResetPasswordPage() {
  const { provider, session, loading } = useAppData();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  if (provider.kind === "mock" || !provider.auth.updatePassword) {
    return (
      <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-600/25">
            <Info className="size-6" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Version de démonstration</h2>
          <p className="max-w-sm text-sm text-neutral-600">
            La gestion des mots de passe est simulée dans cette version.
          </p>
          <Link href="/login" className="text-sm text-sky-700 hover:underline">
            Retour à la connexion
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
        <CardContent className="space-y-3 py-10">
          <Skeleton className="mx-auto h-6 w-48" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Info className="size-6" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Lien invalide ou expiré</h2>
          <p className="max-w-sm text-sm text-neutral-600">
            Ce lien de réinitialisation n&apos;est plus valable. Redemandez un
            email depuis la page « Mot de passe oublié ».
          </p>
          <Link
            href="/forgot-password"
            className="text-sm text-sky-700 hover:underline"
          >
            Redemander un lien
          </Link>
        </CardContent>
      </Card>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("Mot de passe trop court (6 caractères minimum).");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    startTransition(async () => {
      try {
        await provider.auth.updatePassword!(password);
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Changement impossible, réessayez."
        );
        return;
      }
      toast.success("Mot de passe mis à jour !");
      router.push("/dashboard");
    });
  };

  return (
    <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <KeyRound className="size-5 text-sky-700" aria-hidden />
          Nouveau mot de passe
        </CardTitle>
        <CardDescription>
          Compte {session.user.email} — choisissez votre nouveau mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmez le mot de passe</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Mise à jour…" : "Mettre à jour le mot de passe"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
