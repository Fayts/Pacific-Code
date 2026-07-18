"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Controller,
  useForm,
  useWatch,
  type FieldPath,
} from "react-hook-form";
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
import { useAppData } from "@/components/providers/app-data-provider";
import { createCustomer, updateCustomer } from "@/lib/services/customer-service";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import { CUSTOMER_TYPE_LABELS } from "@/lib/core/labels";
import type { Customer, CustomerType } from "@/lib/types/database";

const FIELD_NAMES: FieldPath<CustomerInput>[] = [
  "type",
  "firstName",
  "lastName",
  "companyName",
  "email",
  "phone",
  "address",
  "idNumber",
  "internalNotes",
];

/** Formulaire de création / modification d'un client. */
export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: customer?.type ?? "individual",
      firstName: customer?.first_name ?? "",
      lastName: customer?.last_name ?? "",
      companyName: customer?.company_name ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
      address: customer?.address ?? "",
      idNumber: customer?.id_number ?? "",
      internalNotes: customer?.internal_notes ?? "",
    },
  });

  const type = useWatch({ control, name: "type" });

  const applyFieldErrors = (fieldErrors?: Record<string, string[]>) => {
    if (!fieldErrors) return;
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const name = FIELD_NAMES.find((n) => n === field);
      if (name && messages?.[0]) {
        setError(name, { type: "server", message: messages[0] });
      }
    }
  };

  const onSubmit = (values: CustomerInput) => {
    startTransition(async () => {
      if (customer) {
        const result = await updateCustomer(customer.id, values, provider);
        if (!result.ok) {
          toast.error(result.error);
          applyFieldErrors(result.fieldErrors);
          return;
        }
        toast.success("Client mis à jour");
        router.push(`/customers/${customer.id}`);
      } else {
        const result = await createCustomer(values, provider);
        if (!result.ok) {
          toast.error(result.error);
          applyFieldErrors(result.fieldErrors);
          return;
        }
        toast.success("Client créé");
        router.push(`/customers/${result.data.customerId}`);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {customer ? "Informations du client" : "Nouveau client"}
        </CardTitle>
        <CardDescription>
          {customer
            ? "Modifiez les informations de ce client."
            : "Renseignez les informations du client. Seul le nom est obligatoire."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label>Type de client</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as CustomerType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">
                      {CUSTOMER_TYPE_LABELS.individual}
                    </SelectItem>
                    <SelectItem value="company">
                      {CUSTOMER_TYPE_LABELS.company}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {type === "company" && (
            <div className="space-y-2">
              <Label htmlFor="companyName">Nom de la société</Label>
              <Input
                id="companyName"
                placeholder="Pacific Services SARL"
                {...register("companyName")}
              />
              {errors.companyName && (
                <p className="text-sm text-red-600">
                  {errors.companyName.message}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" placeholder="Jean" {...register("firstName")} />
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input id="lastName" placeholder="Dupont" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="client@exemple.pf"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              rows={2}
              placeholder="Papeete, Tahiti, Polynésie française"
              {...register("address")}
            />
            {errors.address && (
              <p className="text-sm text-red-600">{errors.address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="idNumber">
              N° d&apos;identification{" "}
              <span className="font-normal text-neutral-400">(facultatif)</span>
            </Label>
            <Input
              id="idNumber"
              placeholder="N° Tahiti, CNI, permis…"
              {...register("idNumber")}
            />
            {errors.idNumber && (
              <p className="text-sm text-red-600">{errors.idNumber.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="internalNotes">Notes internes</Label>
            <Textarea
              id="internalNotes"
              rows={3}
              placeholder="Visibles uniquement par votre équipe"
              {...register("internalNotes")}
            />
            {errors.internalNotes && (
              <p className="text-sm text-red-600">
                {errors.internalNotes.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              render={
                <Link
                  href={customer ? `/customers/${customer.id}` : "/customers"}
                />
              }
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Enregistrement…"
                : customer
                  ? "Enregistrer les modifications"
                  : "Créer le client"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
