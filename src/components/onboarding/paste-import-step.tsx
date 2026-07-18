"use client";

import { useState } from "react";
import { ClipboardPaste, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeText, type AnalyzeOutcome } from "@/lib/import/ai";
import { MAX_TEXT_LENGTH } from "@/lib/import/text-parser";

const EXAMPLE = `Nous proposons 3 scooters Honda PCX à 6 000 XPF par jour, 2 Toyota Yaris à 9 000 XPF par jour et un Kärcher Puzzi 10/1 à 7 990 XPF. Une caution de 20 000 XPF est demandée pour le matériel. La livraison est gratuite entre Papenoo et Papeete.`;

// Collage libre : une description d’activité ou plusieurs annonces
// séparées par des lignes vides.
export function PasteImportStep({
  initialText,
  onAnalyzed,
}: {
  initialText: string;
  onAnalyzed: (text: string, outcome: AnalyzeOutcome) => void;
}) {
  const [text, setText] = useState(initialText);
  const [analyzing, setAnalyzing] = useState(false);

  const run = async () => {
    if (!text.trim()) {
      toast.error("Collez d’abord un texte à analyser.");
      return;
    }
    setAnalyzing(true);
    try {
      const outcome = await analyzeText(text.trim());
      if (outcome.items.length === 0) {
        toast.warning(
          "Aucun bien détecté. Vérifiez que le texte contient des noms et des prix, ou complétez manuellement à l’étape suivante."
        );
      }
      onAnalyzed(text.trim(), outcome);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl bg-card p-6 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25">
            <ClipboardPaste className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">
              Collez vos annonces ou votre description
            </h2>
            <p className="text-sm text-muted-foreground">
              Plusieurs annonces ? Séparez-les par une ligne vide.
            </p>
          </div>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
          placeholder={EXAMPLE}
          rows={9}
          className="mt-4 bg-card"
          aria-label="Texte à analyser"
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground/70">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setText(EXAMPLE)}
          >
            Utiliser l’exemple
          </button>
          <span>
            {text.length.toLocaleString("fr-FR")} /{" "}
            {MAX_TEXT_LENGTH.toLocaleString("fr-FR")}
          </span>
        </div>

        <Button
          type="button"
          onClick={run}
          disabled={analyzing}
          className="mt-4 h-10 w-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
        >
          {analyzing ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Analyse en cours…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              Analyser le texte
            </>
          )}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Rien n’est créé à cette étape : vous vérifierez et corrigerez tout
          avant l’import. Les prix non détectés restent « à compléter » —
          jamais inventés.
        </p>
      </div>
    </div>
  );
}
