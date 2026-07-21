"use client";

import { Suspense, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { useAppData } from "@/components/providers/app-data-provider";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { provider, session, loading } = useAppData();
  const [pending, startTransition] = useTransition();

  // Déjà connecté → direction l'application.
  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard");
    }
  }, [loading, session, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginInput) => {
    startTransition(async () => {
      try {
        await provider.auth.signIn(values.email, values.password);
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Connexion impossible, réessayez."
        );
        return;
      }
      const next = searchParams.get("next");
      // Uniquement un chemin interne ("//" serait interprété comme une URL externe).
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(safeNext ?? "/dashboard");
    });
  };

  return (
    <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-xl">
          Ia ora na&nbsp;!{" "}
          <span aria-hidden className="align-middle text-base">🌺</span>
        </CardTitle>
        <CardDescription>
          Heureux de vous revoir — accédez à votre espace de gestion
        </CardDescription>
      </CardHeader>
      <CardContent>
        {provider.kind === "mock" && (
          <p className="mb-4 rounded-lg border border-cyan-200/70 bg-cyan-50/80 px-3 py-2 text-sm text-cyan-900">
            <strong>Version de démonstration</strong> — entrez n&apos;importe
            quel email et mot de passe : aucune donnée réelle n&apos;est
            utilisée.
          </p>
        )}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="vous@entreprise.pf"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-sky-700 hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="h-10 w-full border-0 bg-gradient-to-r from-sky-600 via-cyan-500 to-teal-500 text-sm font-semibold text-white shadow-lg shadow-cyan-600/25 hover:brightness-105"
            disabled={pending}
          >
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-600">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-sky-700 hover:underline">
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
