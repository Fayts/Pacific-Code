"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { updateOrganizationSettings } from "@/server/actions/organizations";
import {
  organizationSettingsSchema,
  type OrganizationSettingsInput,
} from "@/lib/validations/organization";
import { BUSINESS_TYPE_LABELS } from "@/lib/core/labels";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/core/org";
import type { BusinessType, Organization } from "@/lib/types/database";

const DATE_FORMAT_OPTIONS = [
  { value: "dd/MM/yyyy", label: "JJ/MM/AAAA (31/12/2026)" },
  { value: "yyyy-MM-dd", label: "AAAA-MM-JJ (2026-12-31)" },
  { value: "MM/dd/yyyy", label: "MM/JJ/AAAA (12/31/2026)" },
] as const;

type DateFormat = (typeof DATE_FORMAT_OPTIONS)[number]["value"];

const BUSINESS_TYPE_ITEMS = Object.entries(BUSINESS_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

const FIELD_NAMES = [
  "name",
  "businessType",
  "currency",
  "timezone",
  "phone",
  "address",
  "bookingPrefix",
  "email",
  "dateFormat",
] as const satisfies ReadonlyArray<keyof OrganizationSettingsInput>;

function isFieldName(
  value: string
): value is keyof OrganizationSettingsInput {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

export function SettingsForm({
  organization,
  readOnly = false,
}: {
  organization: Organization;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<OrganizationSettingsInput>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      name: organization.name,
      businessType: organization.business_type,
      currency: organization.currency,
      timezone: organization.timezone,
      phone: organization.phone ?? "",
      email: organization.email ?? "",
      address: organization.address ?? "",
      bookingPrefix: organization.booking_prefix,
      dateFormat: DATE_FORMAT_OPTIONS.some(
        (o) => o.value === organization.date_format
      )
        ? (organization.date_format as DateFormat)
        : "dd/MM/yyyy",
    },
  });

  const prefixValue = (
    useWatch({ control, name: "bookingPrefix" }) ?? ""
  )
    .trim()
    .toUpperCase();
  const currentYear = new Date().getFullYear();

  const onSubmit = (values: OrganizationSettingsInput) => {
    startTransition(async () => {
      const result = await updateOrganizationSettings(values);
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (isFieldName(field) && messages?.[0]) {
              setError(field, { type: "server", message: messages[0] });
            }
          }
        }
        toast.error(result.error);
        return;
      }
      toast.success("Paramètres enregistrés");
      router.refresh();
    });
  };

  const disabled = readOnly || pending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Entreprise</CardTitle>
          <CardDescription>
            Informations générales de votre entreprise de location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom commercial</Label>
            <Input
              id="name"
              placeholder="Pacific Rent&Clean"
              disabled={disabled}
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
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
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
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
            <FieldError message={errors.businessType?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+689 87 12 34 56"
                disabled={disabled}
                {...register("phone")}
              />
              <FieldError message={errors.phone?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email de contact</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@entreprise.pf"
                disabled={disabled}
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              rows={3}
              placeholder="Papeete, Tahiti, Polynésie française"
              disabled={disabled}
              {...register("address")}
            />
            <FieldError message={errors.address?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Localisation &amp; formats</CardTitle>
          <CardDescription>
            Devise, fuseau horaire et format des dates affichées dans
            l&apos;application.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Devise</Label>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select
                  items={CURRENCY_OPTIONS}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
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
            <FieldError message={errors.currency?.message} />
          </div>

          <div className="space-y-2">
            <Label>Fuseau horaire</Label>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Select
                  items={TIMEZONE_OPTIONS}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
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
            <FieldError message={errors.timezone?.message} />
          </div>

          <div className="space-y-2">
            <Label>Format de date</Label>
            <Controller
              control={control}
              name="dateFormat"
              render={({ field }) => (
                <Select
                  items={DATE_FORMAT_OPTIONS}
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as DateFormat)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMAT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.dateFormat?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Réservations</CardTitle>
          <CardDescription>
            Préfixe utilisé pour la numérotation automatique des réservations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="bookingPrefix">Préfixe</Label>
          <Input
            id="bookingPrefix"
            maxLength={6}
            placeholder="PRC"
            className="w-32 uppercase"
            disabled={disabled}
            {...register("bookingPrefix")}
          />
          <FieldError message={errors.bookingPrefix?.message} />
          <p className="text-sm text-neutral-500">
            Exemple :{" "}
            <span className="font-medium text-neutral-700">
              {prefixValue ? `${prefixValue}-${currentYear}-0001` : "—"}
            </span>
          </p>
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      )}
    </form>
  );
}
