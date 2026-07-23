"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  FolderTree,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  ImportSessionData,
  ItemReviewState,
  ParsedItem,
} from "@/lib/types/import";
import { internalDuplicateIds } from "@/lib/import/duplicates";
import { computeItemIssues, itemReviewState } from "@/lib/import/issues";
import { localId } from "@/lib/import/normalize";

const STATE_BADGES: Record<ItemReviewState, { label: string; className: string }> = {
  ready: { label: "Prêt à importer", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  incomplete: { label: "Incomplet", className: "bg-amber-50 text-amber-800 border-amber-200" },
  duplicate: { label: "Doublon possible", className: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  to_verify: { label: "À vérifier", className: "bg-orange-50 text-orange-800 border-orange-200" },
  error: { label: "Erreur", className: "bg-red-50 text-red-700 border-red-200" },
};

const TRACKING_ITEMS = [
  { value: "stock", label: "Stock groupé" },
  { value: "individual", label: "Fiches individuelles" },
];

const PRICING_ITEMS = [
  { value: "daily", label: "Par jour" },
  { value: "flat", label: "Forfait" },
];

const DUPLICATE_ITEMS = [
  { value: "create", label: "Créer malgré tout" },
  { value: "skip", label: "Ignorer cette ligne" },
  { value: "replace", label: "Remplacer l’existant" },
];

function ReviewBadge({ state }: { state: ItemReviewState }) {
  const badge = STATE_BADGES[state];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        badge.className
      )}
    >
      {badge.label}
    </span>
  );
}

export function ReviewStep({
  session,
  categoryOptions,
  onChange,
  onImport,
  onSaveDraft,
  onBack,
}: {
  session: ImportSessionData;
  /** Catégories existantes de l’espace (pour la liste déroulante). */
  categoryOptions: string[];
  onChange: (next: ImportSessionData) => void;
  onImport: () => void;
  onSaveDraft: () => void;
  onBack: () => void;
}) {
  const internalDupes = useMemo(
    () => internalDuplicateIds(session.items),
    [session.items]
  );

  const analysis = useMemo(() => {
    return session.items.map((item) => {
      const issues = computeItemIssues(item, internalDupes);
      return { item, issues, state: itemReviewState(item, issues) };
    });
  }, [session.items, internalDupes]);

  const active = analysis.filter((a) => !a.item.excluded);
  const categories = useMemo(() => {
    const set = new Map<string, number>();
    for (const { item } of active) {
      const label = item.categoryName.trim() || "Autre";
      set.set(label, (set.get(label) ?? 0) + 1);
    }
    for (const extra of session.extraCategories) {
      if (!set.has(extra)) set.set(extra, 0);
    }
    return [...set.entries()];
  }, [active, session.extraCategories]);

  const errorCount = active.filter((a) => a.state === "error").length;
  const verifyCount = active.filter(
    (a) => a.state === "to_verify" || a.state === "incomplete" || a.state === "duplicate"
  ).length;
  const readyCount = active.filter((a) => a.state === "ready").length;
  const pricedCount = active.filter((a) => a.item.dailyPrice !== null).length;

  const updateItem = (id: string, patch: Partial<ParsedItem>) => {
    onChange({
      ...session,
      items: session.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });
  };

  const updateBusiness = (patch: Partial<ImportSessionData["business"]>) => {
    onChange({ ...session, business: { ...session.business, ...patch } });
  };

  const addItem = () => {
    const item: ParsedItem = {
      id: localId(),
      name: "",
      categoryName: "",
      tracking: "stock",
      quantity: 1,
      dailyPrice: null,
      pricingMode: "daily",
      depositAmount: null,
      minRentalDays: 1,
      internalRef: "",
      description: "",
      internalNotes: "",
      priceConfidence: "missing",
      depositConfidence: "missing",
      duplicateOfId: null,
      duplicateOfName: null,
      duplicateResolution: "create",
      excluded: false,
    };
    onChange({ ...session, items: [...session.items, item] });
  };

  const allCategoryOptions = useMemo(() => {
    const set = new Set<string>(categoryOptions);
    for (const [name] of categories) set.add(name);
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [categoryOptions, categories]);

  return (
    <div>
      {/* Résumé */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-medium ring-1 ring-pc-deep/[0.08]">
          <FolderTree className="size-3.5 text-primary" aria-hidden />
          {categories.length} catégorie{categories.length > 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-medium ring-1 ring-pc-deep/[0.08]">
          <Package className="size-3.5 text-primary" aria-hidden />
          {active.length} bien{active.length > 1 ? "s" : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-medium ring-1 ring-pc-deep/[0.08]">
          {pricedCount} tarif{pricedCount > 1 ? "s" : ""}
        </span>
        {readyCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 ring-1 ring-emerald-200">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {readyCount} prêt{readyCount > 1 ? "s" : ""}
          </span>
        )}
        {verifyCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="size-3.5" aria-hidden />
            {verifyCount} à vérifier
          </span>
        )}
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 font-medium text-red-700 ring-1 ring-red-200">
            {errorCount} erreur{errorCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Biens ({active.length})</TabsTrigger>
          <TabsTrigger value="business">Entreprise</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="issues">
            Problèmes ({errorCount + verifyCount})
          </TabsTrigger>
        </TabsList>

        {/* ---- Biens ---- */}
        <TabsContent value="items" className="mt-4 space-y-3">
          {analysis.map(({ item, issues, state }) => (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl bg-card p-4 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08] transition-opacity",
                item.excluded && "opacity-50"
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-52 flex-1">
                  <Label className="text-xs text-muted-foreground">Nom</Label>
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    placeholder="Nom du bien"
                    className="mt-1"
                  />
                </div>
                <div className="w-44">
                  <Label className="text-xs text-muted-foreground">
                    Catégorie
                  </Label>
                  <Input
                    value={item.categoryName}
                    onChange={(e) =>
                      updateItem(item.id, { categoryName: e.target.value })
                    }
                    placeholder="Ex. : Scooters"
                    list="import-categories"
                    className="mt-1"
                  />
                </div>
                <div className="w-32">
                  <Label className="text-xs text-muted-foreground">Tarif</Label>
                  <Select
                    items={PRICING_ITEMS}
                    value={item.pricingMode}
                    onValueChange={(v) =>
                      updateItem(item.id, {
                        pricingMode: v as ParsedItem["pricingMode"],
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_ITEMS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">
                    {item.pricingMode === "flat" ? "Prix forfait" : "Prix / jour"}
                  </Label>
                  <Input
                    inputMode="numeric"
                    value={item.dailyPrice ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      updateItem(item.id, {
                        dailyPrice: v === "" ? null : Number(v),
                        priceConfidence: v === "" ? "missing" : "detected",
                      });
                    }}
                    placeholder="à compléter"
                    className="mt-1"
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">Caution</Label>
                  <Input
                    inputMode="numeric"
                    value={item.depositAmount ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      updateItem(item.id, {
                        depositAmount: v === "" ? null : Number(v),
                        depositConfidence: v === "" ? "missing" : "detected",
                      });
                    }}
                    placeholder="—"
                    className="mt-1"
                  />
                </div>
                <div className="w-20">
                  <Label className="text-xs text-muted-foreground">Qté</Label>
                  <Input
                    inputMode="numeric"
                    value={item.quantity}
                    onChange={(e) => {
                      const v = Number(e.target.value.replace(/\D/g, "") || "1");
                      updateItem(item.id, { quantity: Math.max(1, v) });
                    }}
                    className="mt-1"
                  />
                </div>
                {item.quantity > 1 && (
                  <div className="w-44">
                    <Label className="text-xs text-muted-foreground">
                      Gestion
                    </Label>
                    <Select
                      items={TRACKING_ITEMS}
                      value={item.tracking}
                      onValueChange={(v) =>
                        updateItem(item.id, {
                          tracking: v as ParsedItem["tracking"],
                        })
                      }
                    >
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRACKING_ITEMS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ReviewBadge state={state} />
                {issues.map((issue) => (
                  <span
                    key={issue.code}
                    className={cn(
                      "text-xs",
                      issue.level === "error"
                        ? "text-red-700"
                        : issue.level === "warning"
                          ? "text-amber-700"
                          : "text-muted-foreground"
                    )}
                  >
                    {issue.message}
                  </span>
                ))}
                {item.tracking === "individual" && item.quantity > 1 && (
                  <span className="text-xs text-muted-foreground">
                    → {item.quantity} fiches « {item.name || "Bien"} 01…
                    {String(item.quantity).padStart(2, "0")} »
                  </span>
                )}
                <span className="ml-auto flex items-center gap-2">
                  {item.duplicateOfId && (
                    <Select
                      items={DUPLICATE_ITEMS}
                      value={item.duplicateResolution}
                      onValueChange={(v) =>
                        updateItem(item.id, {
                          duplicateResolution:
                            v as ParsedItem["duplicateResolution"],
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs" aria-label="Résolution du doublon">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DUPLICATE_ITEMS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={item.excluded ? "Réintégrer" : "Exclure de l’import"}
                    onClick={() =>
                      updateItem(item.id, { excluded: !item.excluded })
                    }
                  >
                    <Trash2
                      className={cn(
                        "size-4",
                        item.excluded ? "text-muted-foreground" : "text-destructive"
                      )}
                      aria-hidden
                    />
                  </Button>
                </span>
              </div>
            </div>
          ))}

          <datalist id="import-categories">
            {allCategoryOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <Button type="button" variant="outline" onClick={addItem}>
            <Plus className="size-4" aria-hidden />
            Ajouter un bien
          </Button>
        </TabsContent>

        {/* ---- Entreprise ---- */}
        <TabsContent value="business" className="mt-4">
          <div className="max-w-xl rounded-2xl bg-card p-5 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">
                Informations de l’entreprise
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Devise XPF, fuseau Pacific/Tahiti et langue française sont déjà
              configurés par défaut — modifiables dans les Paramètres.
            </p>
            <div className="mt-4 space-y-3">
              {(
                [
                  ["name", "Nom commercial", "Pacific Rent & Clean"],
                  ["phone", "Téléphone", "+689 87 00 00 00"],
                  ["email", "Email", "contact@entreprise.pf"],
                  ["address", "Adresse", "Papeete, Tahiti"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`biz-${key}`}>{label}</Label>
                  <Input
                    id={`biz-${key}`}
                    value={session.business[key] ?? ""}
                    onChange={(e) =>
                      updateBusiness({ [key]: e.target.value || null })
                    }
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="biz-delivery">Livraison / zones desservies</Label>
                <Textarea
                  id="biz-delivery"
                  value={session.business.deliveryNotes ?? ""}
                  onChange={(e) =>
                    updateBusiness({ deliveryNotes: e.target.value || null })
                  }
                  rows={2}
                  placeholder="Ex. : livraison gratuite entre Papenoo et Papeete"
                />
                <p className="text-xs text-muted-foreground/70">
                  Sera repris dans vos conditions de location (à venir) — pensez
                  à le mentionner dans la description des biens concernés.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ---- Catégories ---- */}
        <TabsContent value="categories" className="mt-4">
          <div className="max-w-xl space-y-2">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Les catégories seront déduites des biens à l’import.
              </p>
            )}
            {categories.map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-xl bg-card px-4 py-3 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FolderTree className="size-4 text-primary" aria-hidden />
                  {name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {count > 0
                    ? `${count} bien${count > 1 ? "s" : ""}`
                    : "structure de départ"}
                </span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Les catégories déjà présentes dans votre espace seront
              réutilisées, les autres créées à l’import.
            </p>
          </div>
        </TabsContent>

        {/* ---- Problèmes ---- */}
        <TabsContent value="issues" className="mt-4">
          <div className="max-w-2xl space-y-2">
            {active.flatMap(({ item, issues }) =>
              issues.map((issue) => (
                <div
                  key={`${item.id}-${issue.code}`}
                  className="flex items-center gap-3 rounded-xl bg-card px-4 py-2.5 text-sm shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]"
                >
                  <AlertTriangle
                    className={cn(
                      "size-4 shrink-0",
                      issue.level === "error"
                        ? "text-red-600"
                        : issue.level === "warning"
                          ? "text-amber-600"
                          : "text-muted-foreground"
                    )}
                    aria-hidden
                  />
                  <span className="font-medium">{item.name || "Sans nom"}</span>
                  <span className="text-muted-foreground">{issue.message}</span>
                </div>
              ))
            )}
            {active.every(({ issues }) => issues.length === 0) && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 className="size-4" aria-hidden />
                Aucun problème détecté — tout est prêt.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={onImport}
          disabled={errorCount > 0 || active.length === 0}
          className="h-11 bg-gradient-to-r from-pc-lagoon to-pc-turquoise px-6 font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
        >
          <Copy className="size-4" aria-hidden />
          Importer mon activité
        </Button>
        <Button type="button" variant="outline" onClick={onSaveDraft}>
          Enregistrer comme brouillon
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          Revenir à l’étape précédente
        </Button>
        {errorCount > 0 && (
          <p className="text-sm text-destructive">
            Corrigez les erreurs avant d’importer.
          </p>
        )}
      </div>
    </div>
  );
}
