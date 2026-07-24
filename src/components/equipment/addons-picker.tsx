"use client";

// Accessoires payants proposés avec un matériel : cases à cocher parmi les
// fiches existantes + création rapide en dialogue (un accessoire EST une
// fiche matériel — prix, forfait/jour, stock — rangée en « Accessoires »).

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createEquipment } from "@/lib/services/equipment-service";
import { formatMoney } from "@/lib/core/format";
import type { EquipmentItem, PricingMode } from "@/lib/types/database";

const ACCESSORY_CATEGORY = "Accessoires";

const MODE_ITEMS = [
  { value: "flat", label: "Forfait (prix fixe)" },
  { value: "daily", label: "Par jour" },
];

function priceLabel(item: EquipmentItem, currency: string): string {
  return `${formatMoney(item.daily_price, currency)}${
    item.pricing_mode === "flat" ? " forfait" : " / jour"
  }`;
}

export function AddonsPicker({
  excludeId,
  selected,
  onChange,
  currency,
}: {
  /** Fiche en cours d'édition — jamais proposée comme son propre accessoire. */
  excludeId?: string;
  selected: string[];
  onChange: (next: string[]) => void;
  currency: string;
}) {
  const { provider } = useAppData();
  const [candidates, setCandidates] = useState<EquipmentItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    provider.equipment.list().then((items) => {
      if (!cancelled) setCandidates(items);
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const visible = useMemo(
    () =>
      candidates
        .filter((item) => item.id !== excludeId)
        .sort((a, b) => {
          // Accessoires cochés d'abord, puis alphabétique.
          const aChecked = selected.includes(a.id) ? 0 : 1;
          const bChecked = selected.includes(b.id) ? 0 : 1;
          return aChecked - bChecked || a.name.localeCompare(b.name, "fr");
        }),
    [candidates, excludeId, selected]
  );

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Suppléments proposés avec ce matériel — sur les réservations, la
        vitrine et dans les réponses de l&apos;agent IA. Un accessoire est une
        fiche matériel comme une autre (prix au forfait ou par jour, stock).
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune autre fiche pour l&apos;instant — créez votre premier
          accessoire ci-dessous.
        </p>
      ) : (
        <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {visible.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5">
              <Checkbox
                id={`addon-${item.id}`}
                checked={selected.includes(item.id)}
                onCheckedChange={() => toggle(item.id)}
              />
              <Label
                htmlFor={`addon-${item.id}`}
                className="flex min-w-0 flex-1 items-baseline justify-between gap-2 text-sm font-normal"
              >
                <span className="truncate">{item.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {priceLabel(item, currency)}
                </span>
              </Label>
            </li>
          ))}
        </ul>
      )}

      <QuickAddonDialog
        currency={currency}
        onCreated={(item) => {
          setCandidates((prev) => [...prev, item]);
          onChange([...selected, item.id]);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Création rapide d'un accessoire sans quitter la fiche.
// ------------------------------------------------------------

function QuickAddonDialog({
  currency,
  onCreated,
}: {
  currency: string;
  onCreated: (item: EquipmentItem) => void;
}) {
  const { provider } = useAppData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState<PricingMode>("flat");
  const [quantity, setQuantity] = useState("10");
  const [pending, startTransition] = useTransition();

  const create = () => {
    const trimmed = name.trim();
    const parsedPrice = Number(price.replace(/\D/g, ""));
    const parsedQuantity = Math.max(1, Number(quantity.replace(/\D/g, "")) || 1);
    if (!trimmed || !Number.isFinite(parsedPrice) || parsedPrice <= 0) return;

    startTransition(async () => {
      // Catégorie « Accessoires » réutilisée ou créée à la volée.
      const categories = await provider.categories.list();
      let category = categories.find(
        (c) => c.name.toLowerCase() === ACCESSORY_CATEGORY.toLowerCase()
      );
      if (!category) {
        category = await provider.categories.create(
          ACCESSORY_CATEGORY,
          "Suppléments payants proposés avec le matériel"
        );
      }

      const result = await createEquipment(
        {
          name: trimmed,
          categoryId: category.id,
          internalRef: "",
          description: "",
          dailyPrice: parsedPrice,
          pricingMode: mode,
          depositAmount: 0,
          quantityTotal: parsedQuantity,
          minRentalDays: 1,
          status: "available",
          usageInstructions: "",
          internalNotes: "",
        },
        provider
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const created = await provider.equipment.get(result.data.equipmentId);
      if (created) onCreated(created);
      toast.success(`Accessoire « ${trimmed} » créé et coché`);
      setName("");
      setPrice("");
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" />
        }
      >
        <Plus aria-hidden />
        Nouvel accessoire
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel accessoire</DialogTitle>
          <DialogDescription>
            Créé dans la catégorie « Accessoires » et aussitôt coché sur cette
            fiche. Vous pourrez compléter sa fiche (photo, description) plus
            tard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addon-name">Nom</Label>
            <Input
              id="addon-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. : Pastilles RM 760 (lot de 2)"
              maxLength={200}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="addon-price">Prix ({currency})</Label>
              <Input
                id="addon-price"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="990"
              />
            </div>
            <div className="space-y-2">
              <Label>Tarification</Label>
              <Select
                items={MODE_ITEMS}
                value={mode}
                onValueChange={(v) => setMode(v as PricingMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-quantity">Stock</Label>
              <Input
                id="addon-quantity"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Annuler
          </DialogClose>
          <Button
            type="button"
            onClick={create}
            disabled={pending || !name.trim() || !price.trim()}
          >
            {pending ? "Création…" : "Créer l'accessoire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
