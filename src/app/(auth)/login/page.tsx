"use client";

import { Suspense, useTransition } from "react";
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
import { signIn } from "@/server/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlError = searchParams.get("error");

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
      const result = await signIn(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const next = searchParams.get("next");
      // Uniquement un chemin interne ("//" serait interprété comme une URL externe).
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(safeNext ?? result.data.redirectTo);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Connexion</CardTitle>
        <CardDescription>
          Accédez à votre espace de gestion de location
        </CardDescription>
      </CardHeader>
      <CardContent>
        {urlError && (
          <p className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            Le lien utilisé est invalide ou a expiré. Connectez-vous ou
            demandez un nouveau lien.
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
          <Button type="submit" className="w-full" disabled={pending}>
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
