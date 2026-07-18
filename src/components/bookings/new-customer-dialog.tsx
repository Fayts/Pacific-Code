"use client";

import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { createCustomer } from "@/lib/services/customer-service";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import { CUSTOMER_TYPE_LABELS } from "@/lib/core/labels";
import type { CustomerType } from "@/lib/types/database";
import type { CustomerOption } from "./types";

const EMPTY_VALUES: CustomerInput = {
  type: "individual",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  address: "",
  idNumber: "",
  internalNotes: "",
};

// Création rapide d'un client depuis le parcours de réservation.
export function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: CustomerOption) => void;
}) {
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: EMPTY_VALUES,
  });

  const type = useWatch({ control, name: "type" });

  const onSubmit = (values: CustomerInput) => {
    startTransition(async () => {
      const result = await createCustomer(values, provider);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Client créé");
      onCreated({
        id: result.data.customerId,
        type: values.type,
        first_name: values.firstName || "",
        last_name: values.lastName || "",
        company_name: values.companyName || null,
        email: values.email || null,
        phone: values.phone || null,
      });
      reset(EMPTY_VALUES);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
          <DialogDescription>
            Créez le client puis il sera sélectionné automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-customer-form"
          onSubmit={(event) => {
            // Empêche la soumission du formulaire parent éventuel.
            event.stopPropagation();
            void handleSubmit(onSubmit)(event);
          }}
          className="space-y-4"
          noValidate
        >
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
                    {Object.entries(CUSTOMER_TYPE_LABELS).map(
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

          {type === "company" ? (
            <div className="space-y-2">
              <Label htmlFor="nc-company">Nom de la société</Label>
              <Input
                id="nc-company"
                placeholder="Tahiti Services SARL"
                {...register("companyName")}
              />
              {errors.companyName && (
                <p className="text-sm text-red-600">
                  {errors.companyName.message}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nc-first-name">Prénom</Label>
                <Input
                  id="nc-first-name"
                  placeholder="Jean"
                  {...register("firstName")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nc-last-name">Nom</Label>
                <Input
                  id="nc-last-name"
                  placeholder="Dupont"
                  {...register("lastName")}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nc-phone">Téléphone</Label>
              <Input
                id="nc-phone"
                type="tel"
                placeholder="+689 87 12 34 56"
                {...register("phone")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-email">Email</Label>
              <Input
                id="nc-email"
                type="email"
                placeholder="client@mail.pf"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button type="submit" form="new-customer-form" disabled={pending}>
            {pending ? "Création…" : "Créer le client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
