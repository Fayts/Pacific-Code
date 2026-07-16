"use client";

import { useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeOnboarding } from "@/server/actions/organizations";
import {
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validations/organization";
import { BUSINESS_TYPE_LABELS } from "@/lib/core/labels";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/core/org";
import type { BusinessType } from "@/lib/types/database";

export function OnboardingForm({ defaults }: { defaults: OnboardingInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: defaults,
  });

  const onSubmit = (values: OnboardingInput) => {
    startTransition(async () => {
      const result = await completeOnboarding(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Votre entreprise est prête !");
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Configurez votre entreprise</CardTitle>
        <CardDescription>
          Quelques informations pour préparer votre espace de travail. Tout
          reste modifiable dans les paramètres.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nom commercial</Label>
            <Input
              id="name"
              placeholder="Pacific Rent&Clean"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Type principal de location</Label>
            <Controller
              control={control}
              name="businessType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as BusinessType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BUSINESS_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Devise</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Fuseau horaire</Label>
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+689 87 12 34 56"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-red-600">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bookingPrefix">Préfixe réservations</Label>
              <Input
                id="bookingPrefix"
                placeholder="PRC"
                maxLength={6}
                {...register("bookingPrefix")}
              />
              {errors.bookingPrefix && (
                <p className="text-sm text-red-600">
                  {errors.bookingPrefix.message}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 -mt-2">
            Exemple de numéro : PRC-2026-0001
          </p>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              rows={2}
              placeholder="Papeete, Tahiti, Polynésie française"
              {...register("address")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Création…" : "Créer mon espace de travail"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
