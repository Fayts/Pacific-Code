"use client";

// Aperçu en direct du brouillon construit par l'agent : progression
// réelle, checklist dynamique, cartes de biens modifiables (modifier,
// dupliquer, supprimer, confirmer) avec badges de fiabilité, livraison,
// règles et informations manquantes. Chaque changement de l'agent
// déclenche une micro-animation (pastille + halo sur la carte touchée).

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  FileText,
  Pencil,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DraftItem, OnboardingDraft } from "@/lib/agent/draft";
import type { Completeness } from "@/lib/agent/completeness";
import type { DraftChange } from "@/lib/agent/tools";

const EASE = [0.16, 1, 0.3, 1] as const;

function formatXpf(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} XPF`;
}

type ItemPatch = Partial<
  Pick<DraftItem, "name" | "quantity" | "dailyPrice" | "deposit">
>;

function itemBadge(item: DraftItem): {
  label: string;
  className: string;
} {
  if (item.confirmed) {
    return {
      label: "Confirmé",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    };
  }
  if (
    item.priceConfidence === "missing" ||
    (item.dailyPrice === null &&
      item.hourlyPrice === null &&
      item.weeklyPrice === null)
  ) {
    return {
      label: "Incomplet",
      className: "bg-rose-50 text-rose-700 ring-rose-200",
    };
  }
  if (
    item.priceConfidence === "verify" ||
    item.depositConfidence === "verify" ||
    item.quantityConfidence === "verify"
  ) {
    return {
      label: "À vérifier",
      className: "bg-amber-50 text-amber-800 ring-amber-200",
    };
  }
  return {
    label: "Détecté par l’IA",
    className: "bg-pc-turquoise/10 text-pc-lagoon ring-pc-turquoise/30",
  };
}

function ItemCard({
  item,
  categoryName,
  flashing,
  onEdit,
  onDelete,
  onDuplicate,
  onConfirm,
}: {
  item: DraftItem;
  categoryName: string | null;
  flashing: boolean;
  onEdit: (patch: ItemPatch) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onConfirm: () => void;
}) {
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: item.name,
    quantity: String(item.quantity),
    dailyPrice: item.dailyPrice === null ? "" : String(item.dailyPrice),
    deposit: item.deposit === null ? "" : String(item.deposit),
  });
  const badge = itemBadge(item);

  const startEdit = () => {
    setForm({
      name: item.name,
      quantity: String(item.quantity),
      dailyPrice: item.dailyPrice === null ? "" : String(item.dailyPrice),
      deposit: item.deposit === null ? "" : String(item.deposit),
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const quantity = Math.max(1, parseInt(form.quantity, 10) || 1);
    const dailyPrice =
      form.dailyPrice.trim() === ""
        ? null
        : Math.max(0, parseInt(form.dailyPrice, 10) || 0);
    const deposit =
      form.deposit.trim() === ""
        ? null
        : Math.max(0, parseInt(form.deposit, 10) || 0);
    onEdit({
      name: form.name.trim() || item.name,
      quantity,
      dailyPrice,
      deposit,
    });
    setEditing(false);
  };

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn(
        "rounded-xl bg-card p-3.5 shadow-sm shadow-pc-deep/[0.04] ring-1 transition-shadow duration-500",
        flashing
          ? "ring-2 ring-pc-turquoise shadow-lg shadow-pc-turquoise/20"
          : "ring-pc-deep/[0.08]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {item.name}
            {item.quantity > 1 && (
              <span className="ml-1.5 rounded-md bg-pc-deep/[0.06] px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                ×{item.quantity}
              </span>
            )}
          </p>
          {(item.brand || item.model || categoryName) && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[item.brand, item.model, categoryName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
            badge.className
          )}
        >
          {badge.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {item.dailyPrice !== null ? (
            <>
              <span className="font-semibold text-foreground">
                {formatXpf(item.dailyPrice)}
              </span>
              {item.pricingMode === "flat" ? " forfait" : "/jour"}
              {item.priceConfidence === "verify" && " · à confirmer"}
            </>
          ) : item.hourlyPrice !== null || item.weeklyPrice !== null ? (
            "Tarif non journalier"
          ) : (
            <span className="text-rose-600">Tarif manquant</span>
          )}
        </span>
        <span>
          {item.deposit !== null
            ? item.deposit === 0
              ? "Sans caution"
              : `Caution ${formatXpf(item.deposit)}`
            : "Caution ?"}
        </span>
        {item.options.length > 0 && (
          <span className="w-full truncate">
            Options : {item.options.join(", ")}
          </span>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            aria-label="Nom du bien"
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              value={form.quantity}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: e.target.value }))
              }
              inputMode="numeric"
              aria-label="Quantité"
              placeholder="Qté"
              className="h-8 text-sm"
            />
            <Input
              value={form.dailyPrice}
              onChange={(e) =>
                setForm((f) => ({ ...f, dailyPrice: e.target.value }))
              }
              inputMode="numeric"
              aria-label="Tarif journalier (XPF)"
              placeholder="XPF/jour"
              className="h-8 text-sm"
            />
            <Input
              value={form.deposit}
              onChange={(e) =>
                setForm((f) => ({ ...f, deposit: e.target.value }))
              }
              inputMode="numeric"
              aria-label="Caution (XPF)"
              placeholder="Caution"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setEditing(false)}
            >
              <X className="size-3.5" aria-hidden />
              Annuler
            </Button>
            <Button size="sm" className="h-7 px-2.5 text-xs" onClick={saveEdit}>
              <Check className="size-3.5" aria-hidden />
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-1 border-t border-border/60 pt-2">
          {!item.confirmed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onConfirm}
              className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <BadgeCheck className="size-3.5" aria-hidden />
              Confirmer
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={startEdit}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <Pencil className="size-3.5" aria-hidden />
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicate}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <Copy className="size-3.5" aria-hidden />
            Dupliquer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Supprimer
          </Button>
        </div>
      )}
    </motion.div>
  );
}

export function DraftPanel({
  draft,
  progress,
  flashes,
  onEditItem,
  onDeleteItem,
  onDuplicateItem,
  onConfirmItem,
}: {
  draft: OnboardingDraft;
  progress: Completeness;
  flashes: DraftChange[];
  onEditItem: (id: string, patch: ItemPatch) => void;
  onDeleteItem: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  onConfirmItem: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  const [chips, setChips] = useState<Array<{ key: number; label: string }>>([]);
  const chipKey = useRef(0);

  // Micro-animations : pastilles de changement + halo sur les cartes.
  useEffect(() => {
    if (flashes.length === 0) return;
    const ids = new Set(
      flashes.map((c) => c.itemId).filter((id): id is string => Boolean(id))
    );
    const labels = [...new Set(flashes.map((c) => c.label))];
    const added = labels.map((label) => ({ key: chipKey.current++, label }));
    const clear = setTimeout(() => {
      setFlashingIds(new Set());
      setChips((current) =>
        current.filter((chip) => !added.some((a) => a.key === chip.key))
      );
    }, 2600);
    // Application différée pour rester hors du corps synchrone de l'effet.
    const apply = setTimeout(() => {
      setFlashingIds(ids);
      setChips((current) => [...current.slice(-3), ...added]);
    }, 0);
    return () => {
      clearTimeout(clear);
      clearTimeout(apply);
    };
  }, [flashes]);

  const business = draft.business;
  const hasBusiness =
    business.name ||
    business.phone ||
    business.email ||
    business.address ||
    business.openingHours;

  return (
    <div className="space-y-4">
      {/* Progression réelle */}
      <div className="rounded-2xl bg-card p-4 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            Votre activité est prête à {progress.percent}&nbsp;%
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pc-deep/10">
          <motion.div
            initial={false}
            animate={{ width: `${Math.max(2, progress.percent)}%` }}
            transition={{ duration: 0.6, ease: EASE }}
            className="h-full rounded-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise"
          />
        </div>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {progress.checklist.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                entry.done ? "text-muted-foreground/70" : "text-foreground"
              )}
            >
              {entry.done ? (
                <CheckCircle2
                  className="size-3.5 shrink-0 text-pc-turquoise"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="size-3.5 shrink-0 text-muted-foreground/30"
                  aria-hidden
                />
              )}
              <span className={cn(entry.done && "line-through")}>
                {entry.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pastilles de changement */}
      <div
        aria-live="polite"
        className={cn("flex flex-wrap gap-1.5", chips.length === 0 && "hidden")}
      >
        <AnimatePresence>
          {chips.map((chip) => (
            <motion.span
              key={chip.key}
              initial={reduce ? false : { opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="inline-flex items-center gap-1 rounded-full bg-pc-turquoise/10 px-2.5 py-1 text-xs font-medium text-pc-lagoon ring-1 ring-pc-turquoise/30"
            >
              <Sparkles className="size-3" aria-hidden />
              {chip.label}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Entreprise */}
      {hasBusiness && (
        <div className="rounded-2xl bg-card p-4 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Building2 className="size-3.5" aria-hidden />
            Entreprise
          </p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">
            {business.name ?? "Nom à préciser"}
          </p>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {business.phone && <p>{business.phone}</p>}
            {business.email && <p>{business.email}</p>}
            {business.address && <p>{business.address}</p>}
            {business.openingHours && <p>Horaires : {business.openingHours}</p>}
          </div>
        </div>
      )}

      {/* Catégories */}
      {draft.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {draft.categories.map((category) => (
            <span
              key={category.id}
              className="rounded-full bg-pc-deep/[0.05] px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-pc-deep/[0.08]"
            >
              {category.name}
            </span>
          ))}
        </div>
      )}

      {/* Biens */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Biens détectés ({draft.items.length})
        </p>
        {draft.items.length === 0 && (
          <p className="rounded-xl border border-dashed border-pc-lagoon/25 bg-card/60 p-4 text-center text-xs text-muted-foreground">
            Décrivez ce que vous louez : les biens détectés apparaîtront ici
            en direct.
          </p>
        )}
        <AnimatePresence initial={false}>
          {draft.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              categoryName={
                draft.categories.find((c) => c.id === item.categoryId)?.name ??
                null
              }
              flashing={flashingIds.has(item.id)}
              onEdit={(patch) => onEditItem(item.id, patch)}
              onDelete={() => onDeleteItem(item.id)}
              onDuplicate={() => onDuplicateItem(item.id)}
              onConfirm={() => onConfirmItem(item.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Livraison */}
      {draft.delivery.enabled !== null && (
        <div className="rounded-2xl bg-card p-4 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Truck className="size-3.5" aria-hidden />
            Livraison
          </p>
          {draft.delivery.enabled ? (
            <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              {draft.delivery.freeZones.length > 0 && (
                <p>
                  Gratuite :{" "}
                  <span className="text-foreground">
                    {draft.delivery.freeZones.join(", ")}
                  </span>
                </p>
              )}
              {draft.delivery.paidZones.map((zone) => (
                <p key={zone.zone}>
                  {zone.zone} :{" "}
                  <span className="text-foreground">
                    {zone.fee !== null ? formatXpf(zone.fee) : "tarif à préciser"}
                  </span>
                </p>
              ))}
              {draft.delivery.notes && <p>{draft.delivery.notes}</p>}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Pas de livraison.
            </p>
          )}
        </div>
      )}

      {/* Règles et documents */}
      {(draft.bookingRules.requestedDocuments !== null ||
        draft.bookingRules.paymentMethods !== null ||
        draft.bookingRules.minimumDurationDays !== null) && (
        <div className="rounded-2xl bg-card p-4 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="size-3.5" aria-hidden />
            Réservations
          </p>
          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {draft.bookingRules.requestedDocuments !== null && (
              <p>
                Documents :{" "}
                <span className="text-foreground">
                  {draft.bookingRules.requestedDocuments.length > 0
                    ? draft.bookingRules.requestedDocuments.join(", ")
                    : "aucun"}
                </span>
              </p>
            )}
            {draft.bookingRules.paymentMethods !== null && (
              <p>
                Paiement :{" "}
                <span className="text-foreground">
                  {draft.bookingRules.paymentMethods.join(", ") || "—"}
                </span>
              </p>
            )}
            {draft.bookingRules.minimumDurationDays !== null && (
              <p>
                Durée minimale :{" "}
                <span className="text-foreground">
                  {draft.bookingRules.minimumDurationDays} jour
                  {draft.bookingRules.minimumDurationDays > 1 ? "s" : ""}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Informations manquantes */}
      {draft.missing.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
            <AlertTriangle className="size-3.5" aria-hidden />
            À compléter
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-amber-800">
            {draft.missing.map((entry) => (
              <li key={entry.id}>
                {entry.topic}
                {entry.note && ` — ${entry.note}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
