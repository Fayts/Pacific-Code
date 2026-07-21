"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppData } from "@/components/providers/app-data-provider";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { BUSINESS_TYPE_LABELS } from "@/lib/core/labels";
import type { BusinessType } from "@/lib/types/database";

const BUSINESS_TYPE_ITEMS = Object.entries(BUSINESS_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

export default function RegisterPage() {
  const router = useRouter();
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      companyName: "",
      businessType: "equipment",
    },
  });

  const onSubmit = (values: RegisterInput) => {
    startTransition(async () => {
      try {
        await provider.auth.signUp({
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          companyName: values.companyName,
          businessType: values.businessType,
        });
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Création du compte impossible, réessayez."
        );
        return;
      }
      toast.success(
        `Bienvenue ! Votre espace « ${values.companyName} » est prêt.`
      );
      // Direction l'onboarding : import rapide de l'activité.
      router.push("/onboarding");
    });
  };

  return (
    <Card className="border-white/60 bg-white/85 shadow-xl shadow-cyan-900/10 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-xl">
          Bienvenue à bord{" "}
          <span aria-hidden className="align-middle text-base">🌺</span>
        </CardTitle>
        <CardDescription>
          Créez votre espace de gestion en moins de deux minutes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {provider.kind === "mock" && (
          <p className="mb-4 rounded-lg border border-cyan-200/70 bg-cyan-50/80 px-3 py-2 text-sm text-cyan-900">
            <strong>Version de démonstration</strong> — le compte est créé
            instantanément sur cet appareil, sans email de confirmation. Votre
            espace arrive pré-rempli de données fictives pour explorer
            l&apos;application.
          </p>
        )}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-sm text-red-600">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-sm text-red-600">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Nom de l&apos;entreprise</Label>
            <Input
              id="companyName"
              autoComplete="organization"
              placeholder="Pacific Rent&Clean"
              {...register("companyName")}
            />
            {errors.companyName && (
              <p className="text-sm text-red-600">
                {errors.companyName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Type d&apos;activité</Label>
            <Controller
              control={control}
              name="businessType"
              render={({ field }) => (
                <Select
                  items={BUSINESS_TYPE_ITEMS}
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as BusinessType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPE_ITEMS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <Button
            type="submit"
            className="h-10 w-full border-0 bg-gradient-to-r from-sky-600 via-cyan-500 to-teal-500 text-sm font-semibold text-white shadow-lg shadow-cyan-600/25 hover:brightness-105"
            disabled={pending}
          >
            {pending ? "Création du compte…" : "Créer mon compte"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-600">
          Déjà inscrit ?{" "}
          <Link href="/login" className="text-sky-700 hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
