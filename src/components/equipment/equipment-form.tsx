"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { CategoryDialog } from "@/components/equipment/category-dialog";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  createEquipment,
  updateEquipment,
} from "@/lib/services/equipment-service";
import { equipmentSchema, type EquipmentInput } from "@/lib/validations/equipment";
import { EQUIPMENT_STATUS } from "@/lib/core/labels";
import type { EquipmentItem, EquipmentStatus } from "@/lib/types/database";

type EquipmentFormValues = z.input<typeof equipmentSchema>;

const NO_CATEGORY = "none";
const STATUS_OPTIONS: EquipmentStatus[] = ["available", "maintenance", "unavailable"];

type EquipmentFormProps = {
  categories: { id: string; name: string }[];
  currency: string;
  /** Présent en mode édition. */
  equipment?: EquipmentItem;
};

export function EquipmentForm({
  categories,
  currency,
  equipment,
}: EquipmentFormProps) {
  const router = useRouter();
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();
  const [categoryList, setCategoryList] = useState(categories);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<EquipmentFormValues, unknown, EquipmentInput>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: equipment
      ? {
          name: equipment.name,
          categoryId: equipment.category_id,
          internalRef: equipment.internal_ref ?? "",
          description: equipment.description ?? "",
          dailyPrice: equipment.daily_price,
          depositAmount: equipment.deposit_amount,
          quantityTotal: equipment.quantity_total,
          minRentalDays: equipment.min_rental_days,
          status: equipment.status,
          usageInstructions: equipment.usage_instructions ?? "",
          internalNotes: equipment.internal_notes ?? "",
        }
      : {
          name: "",
          categoryId: null,
          internalRef: "",
          description: "",
          dailyPrice: 0,
          depositAmount: 0,
          quantityTotal: 1,
          minRentalDays: 1,
          status: "available",
          usageInstructions: "",
          internalNotes: "",
        },
  });

  const categoryItems = useMemo(
    () => ({
      [NO_CATEGORY]: "Sans catégorie",
      ...Object.fromEntries(categoryList.map((c) => [c.id, c.name])),
    }),
    [categoryList]
  );

  const statusItems = useMemo(
    () =>
      Object.fromEntries(
        STATUS_OPTIONS.map((s) => [s, EQUIPMENT_STATUS[s].label])
      ) as Record<EquipmentStatus, string>,
    []
  );

  const onSubmit = (values: EquipmentInput) => {
    startTransition(async () => {
      if (equipment) {
        const result = await updateEquipment(equipment.id, values, provider);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Matériel mis à jour");
        router.push(`/equipment/${equipment.id}`);
        return;
      }

      const result = await createEquipment(values, provider);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Matériel créé");
      router.push(`/equipment/${result.data.equipmentId}`);
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-3xl space-y-6"
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du matériel</Label>
            <Input
              id="name"
              placeholder="Ex. : Nettoyeur haute pression Kärcher K7"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Catégorie</Label>
                <CategoryDialog
                  onCreated={(category) => {
                    setCategoryList((prev) =>
                      [...prev, category].sort((a, b) =>
                        a.name.localeCompare(b.name, "fr")
                      )
                    );
                    setValue("categoryId", category.id, { shouldDirty: true });
                  }}
                />
              </div>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    items={categoryItems}
                    value={field.value ?? NO_CATEGORY}
                    onValueChange={(value) =>
                      field.onChange(value === NO_CATEGORY ? null : value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>Sans catégorie</SelectItem>
                      {categoryList.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalRef">Référence interne</Label>
              <Input
                id="internalRef"
                placeholder="Ex. : NHP-001"
                {...register("internalRef")}
              />
              {errors.internalRef && (
                <p className="text-sm text-red-600">
                  {errors.internalRef.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Caractéristiques, accessoires fournis…"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarification et stock</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dailyPrice">Prix journalier ({currency})</Label>
            <Input
              id="dailyPrice"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              {...register("dailyPrice")}
            />
            {errors.dailyPrice && (
              <p className="text-sm text-red-600">{errors.dailyPrice.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="depositAmount">Caution ({currency})</Label>
            <Input
              id="depositAmount"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              {...register("depositAmount")}
            />
            {errors.depositAmount && (
              <p className="text-sm text-red-600">
                {errors.depositAmount.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantityTotal">Quantité totale</Label>
            <Input
              id="quantityTotal"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              {...register("quantityTotal")}
            />
            {errors.quantityTotal && (
              <p className="text-sm text-red-600">
                {errors.quantityTotal.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="minRentalDays">Durée minimale (jours)</Label>
            <Input
              id="minRentalDays"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              {...register("minRentalDays")}
            />
            {errors.minRentalDays && (
              <p className="text-sm text-red-600">
                {errors.minRentalDays.message}
              </p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Statut</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  items={statusItems}
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as EquipmentStatus)
                  }
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {EQUIPMENT_STATUS[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consignes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usageInstructions">
              Instructions d&apos;utilisation
            </Label>
            <Textarea
              id="usageInstructions"
              rows={3}
              placeholder="Consignes remises au client lors du départ…"
              {...register("usageInstructions")}
            />
            {errors.usageInstructions && (
              <p className="text-sm text-red-600">
                {errors.usageInstructions.message}
              </p>
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
        </CardContent>
      </Card>

      <p className="text-sm text-neutral-500">
        Version de démonstration : l&apos;ajout de photos sera disponible une
        fois le stockage en ligne connecté.
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          render={
            <Link
              href={equipment ? `/equipment/${equipment.id}` : "/equipment"}
            />
          }
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Enregistrement…"
            : equipment
              ? "Enregistrer les modifications"
              : "Créer le matériel"}
        </Button>
      </div>
    </form>
  );
}
