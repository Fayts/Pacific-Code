"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { blobToDataUrl, compressPhoto } from "@/lib/core/photo";
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
import { AddonsPicker } from "@/components/equipment/addons-picker";
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
const PRICING_MODE_ITEMS = [
  { value: "daily", label: "Par jour" },
  { value: "flat", label: "Forfait (prix fixe)" },
];

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
  // Photo : aperçu local (data URL) + blob compressé à téléverser.
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    equipment?.photo_url ?? null
  );
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Accessoires payants liés (appliqués à l'enregistrement).
  const [addonIds, setAddonIds] = useState<string[]>([]);

  useEffect(() => {
    if (!equipment) return;
    let cancelled = false;
    provider.equipment.listAddons(equipment.id).then((addons) => {
      if (!cancelled) setAddonIds(addons.map((a) => a.id));
    });
    return () => {
      cancelled = true;
    };
  }, [provider, equipment]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await compressPhoto(file);
      setPhotoBlob(blob);
      setPhotoPreview(await blobToDataUrl(blob));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Photo illisible — réessayez."
      );
    }
  };

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
          pricingMode: equipment.pricing_mode,
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
          pricingMode: "daily",
          depositAmount: 0,
          quantityTotal: 1,
          minRentalDays: 1,
          status: "available",
          usageInstructions: "",
          internalNotes: "",
        },
  });

  const pricingMode = useWatch({ control, name: "pricingMode" });

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
      // Photo : téléversée seulement à l'enregistrement (jamais orpheline).
      let photoUrl: string | null | undefined = photoPreview;
      if (photoBlob && provider.uploadEquipmentPhoto) {
        try {
          photoUrl = await provider.uploadEquipmentPhoto(photoBlob);
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `Photo non enregistrée : ${err.message}`
              : "Photo non enregistrée — réessayez."
          );
          return;
        }
      } else if (equipment && photoPreview === equipment.photo_url) {
        photoUrl = undefined; // inchangée
      }
      values = { ...values, photoUrl };

      const saveAddons = async (equipmentId: string) => {
        try {
          await provider.equipment.setAddons(equipmentId, addonIds);
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `Accessoires non enregistrés : ${err.message}`
              : "Accessoires non enregistrés — rouvrez la fiche."
          );
        }
      };

      if (equipment) {
        const result = await updateEquipment(equipment.id, values, provider);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        await saveAddons(equipment.id);
        toast.success("Matériel mis à jour");
        router.push(`/equipment/${equipment.id}`);
        return;
      }

      const result = await createEquipment(values, provider);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      await saveAddons(result.data.equipmentId);
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
              <p className="text-sm text-destructive">{errors.name.message}</p>
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
                <p className="text-sm text-destructive">
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
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Photo</Label>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Photo du matériel"
                  className="size-24 rounded-xl object-cover ring-1 ring-pc-deep/10"
                />
              ) : (
                <span className="flex size-24 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <ImagePlus className="size-6" aria-hidden />
                </span>
              )}
              <div className="flex flex-col items-start gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoPreview ? "Changer la photo" : "Ajouter une photo"}
                </Button>
                {photoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoBlob(null);
                    }}
                  >
                    Retirer la photo
                  </Button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void pickPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Affichée sur votre vitrine publique — compressée automatiquement.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarification et stock</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tarification</Label>
            <Controller
              control={control}
              name="pricingMode"
              render={({ field }) => (
                <Select
                  items={PRICING_MODE_ITEMS}
                  value={field.value ?? "daily"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_MODE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              {pricingMode === "flat"
                ? "Prix fixe, quelle que soit la durée (prestation, service)."
                : "Le prix se multiplie par le nombre de jours."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dailyPrice">
              {pricingMode === "flat"
                ? `Prix forfaitaire (${currency})`
                : `Prix journalier (${currency})`}
            </Label>
            <Input
              id="dailyPrice"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              {...register("dailyPrice")}
            />
            {errors.dailyPrice && (
              <p className="text-sm text-destructive">{errors.dailyPrice.message}</p>
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
              <p className="text-sm text-destructive">
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
              <p className="text-sm text-destructive">
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
              <p className="text-sm text-destructive">
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
          <CardTitle>Accessoires payants</CardTitle>
        </CardHeader>
        <CardContent>
          <AddonsPicker
            excludeId={equipment?.id}
            selected={addonIds}
            onChange={setAddonIds}
            currency={currency}
          />
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
              <p className="text-sm text-destructive">
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
              <p className="text-sm text-destructive">
                {errors.internalNotes.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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
