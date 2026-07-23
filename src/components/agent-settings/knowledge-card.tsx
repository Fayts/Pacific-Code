"use client";

// Base de connaissances de l'agent : les questions courantes et LA réponse
// que le loueur veut voir partir. L'agent cite la réponse telle quelle —
// aucun modèle de langage, aucun crédit consommé.
//
// L'encart de test rejoue l'appariement réel (même fonction que le moteur)
// pour que le loueur voie AVANT d'activer ce qu'un client recevrait.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAppData } from "@/components/providers/app-data-provider";
import { rankKnowledge, MIN_KNOWLEDGE_SCORE } from "@/lib/ai/knowledge";
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  parseKeywords,
  updateKnowledgeEntry,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
} from "@/lib/services/knowledge-service";
import type { KnowledgeEntry } from "@/lib/types/inbox";

const CATEGORY_ITEMS: Record<string, string> = Object.fromEntries(
  KNOWLEDGE_CATEGORIES.map((key) => [
    key,
    KNOWLEDGE_CATEGORY_LABELS[key] ?? key,
  ])
);

type FormState = {
  question: string;
  answer: string;
  keywords: string;
  category: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  question: "",
  answer: "",
  keywords: "",
  category: "general",
  isActive: true,
};

export function KnowledgeCard({ entries }: { entries: KnowledgeEntry[] }) {
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [probe, setProbe] = useState("");

  const active = entries.filter((entry) => entry.is_active).length;

  // Rejoue l'appariement du moteur sur la question de test.
  const probeResults = useMemo(
    () => (probe.trim() ? rankKnowledge(probe, entries).slice(0, 3) : []),
    [probe, entries]
  );
  const probeWinner =
    probeResults[0] && probeResults[0].score >= MIN_KNOWLEDGE_SCORE
      ? probeResults[0]
      : null;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (entry: KnowledgeEntry) => {
    setEditing(entry);
    setForm({
      question: entry.question,
      answer: entry.answer,
      keywords: entry.keywords.join(", "),
      category: entry.category,
      isActive: entry.is_active,
    });
    setDialogOpen(true);
  };

  const submit = () => {
    const payload = {
      question: form.question,
      answer: form.answer,
      keywords: parseKeywords(form.keywords),
      category: form.category,
      isActive: form.isActive,
      priority: editing?.priority ?? 0,
    };
    startTransition(async () => {
      const result = editing
        ? await updateKnowledgeEntry(editing.id, payload, provider)
        : await createKnowledgeEntry(payload, provider);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Réponse modifiée" : "Réponse ajoutée");
      setDialogOpen(false);
    });
  };

  const toggleActive = (entry: KnowledgeEntry, isActive: boolean) => {
    startTransition(async () => {
      const result = await updateKnowledgeEntry(entry.id, { isActive }, provider);
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden />
          Base de connaissances
        </CardTitle>
        <CardDescription>
          Les questions qui reviennent — paiement, caution, livraison,
          horaires… — et la réponse exacte que vous voulez voir partir.
          L&apos;agent la cite telle quelle, il ne la reformule jamais et
          n&apos;invente rien. Aucun crédit d&apos;IA n&apos;est consommé.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Test en direct : ce qu'un client recevrait, avant d'activer. */}
        <div className="space-y-2 rounded-xl bg-muted/50 p-3">
          <Label htmlFor="kb-probe" className="text-xs">
            Testez une question de client
          </Label>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="kb-probe"
              value={probe}
              onChange={(event) => setProbe(event.target.value)}
              placeholder="Ex. : est-ce que je peux payer en carte ?"
              className="pl-8"
              maxLength={200}
            />
          </div>
          {probe.trim() && (
            <div className="text-sm">
              {probeWinner ? (
                <div className="space-y-1">
                  <p className="text-emerald-700">
                    L&apos;agent répondrait avec «&nbsp;
                    {probeWinner.entry.question}&nbsp;»
                  </p>
                  <p className="whitespace-pre-line rounded-lg bg-background p-2 text-muted-foreground">
                    {probeWinner.entry.answer}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Déclenché par : {probeWinner.matched.join(", ")}
                  </p>
                </div>
              ) : (
                <p className="text-amber-800">
                  Aucune réponse assez sûre — l&apos;agent transmettrait la
                  question. Ajoutez une entrée ou complétez les mots-clés.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {entries.length === 0
              ? "Aucune réponse enregistrée"
              : `${entries.length} réponse${entries.length > 1 ? "s" : ""} — ${active} active${active > 1 ? "s" : ""}`}
          </p>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus aria-hidden />
            Ajouter une réponse
          </Button>
        </div>

        {entries.length > 0 && (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl bg-card p-3 shadow-sm ring-1 ring-pc-deep/[0.08]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {entry.question}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {entry.answer}
                    </p>
                    {entry.keywords.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Mots-clés : {entry.keywords.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={entry.is_active}
                      disabled={pending}
                      onCheckedChange={(checked) =>
                        toggleActive(entry, checked)
                      }
                      aria-label={
                        entry.is_active
                          ? "Désactiver cette réponse"
                          : "Activer cette réponse"
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Modifier"
                      onClick={() => openEdit(entry)}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Supprimer"
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      }
                      title="Supprimer cette réponse ?"
                      description="L'agent ne pourra plus répondre à cette question — il la transmettra."
                      confirmLabel="Supprimer"
                      destructive
                      onConfirm={async () => {
                        const result = await deleteKnowledgeEntry(
                          entry.id,
                          provider
                        );
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Réponse supprimée");
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier la réponse" : "Nouvelle réponse"}
            </DialogTitle>
            <DialogDescription>
              La réponse part telle quelle au client : rédigez-la comme vous
              l&apos;écririez vous-même.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kb-question">Question type</Label>
              <Input
                id="kb-question"
                value={form.question}
                onChange={(event) =>
                  setForm({ ...form, question: event.target.value })
                }
                placeholder="Comment puis-je payer ma location ?"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-answer">Réponse envoyée</Label>
              <Textarea
                id="kb-answer"
                value={form.answer}
                onChange={(event) =>
                  setForm({ ...form, answer: event.target.value })
                }
                placeholder="Le règlement se fait au retrait, en espèces ou par carte bancaire…"
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kb-keywords">Mots-clés déclencheurs</Label>
              <Input
                id="kb-keywords"
                value={form.keywords}
                onChange={(event) =>
                  setForm({ ...form, keywords: event.target.value })
                }
                placeholder="payer, paiement, carte bancaire, especes"
                maxLength={400}
              />
              <p className="text-xs text-muted-foreground">
                Séparés par des virgules. Un seul mot-clé retrouvé dans le
                message suffit à déclencher cette réponse — accents et
                majuscules sont ignorés.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kb-category">Catégorie</Label>
                <Select
                  items={CATEGORY_ITEMS}
                  value={form.category}
                  onValueChange={(value) =>
                    setForm({ ...form, category: String(value) })
                  }
                >
                  <SelectTrigger id="kb-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 sm:pt-7">
                <Switch
                  id="kb-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isActive: checked })
                  }
                />
                <Label htmlFor="kb-active" className="cursor-pointer">
                  Réponse active
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
