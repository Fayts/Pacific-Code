"use client";

import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeText, type AnalyzeOutcome } from "@/lib/import/ai";

// Import depuis un site web — MODE DÉMONSTRATION.
// L’extraction réelle (récupération du contenu public côté serveur) n’est
// pas encore branchée : cette étape illustre le parcours avec un contenu
// d’exemple clairement signalé. L’abstraction serveur à brancher plus tard
// est la même route /api/import/parse (contenu du site → analyse → brouillon).
const DEMO_CONTENT = `Pacific Rent & Clean — location de matériel et de véhicules à Tahiti.
Nous proposons 2 Kärcher Puzzi 10/1 à 7 990 XPF par jour et un Kärcher Puzzi 8/1 à 6 990 XPF par jour. Une caution de 20 000 XPF est demandée pour le matériel.
La livraison est gratuite entre Papenoo et Papeete.`;

export function WebsiteImportStep({
  onAnalyzed,
}: {
  onAnalyzed: (url: string, outcome: AnalyzeOutcome) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    let valid: URL;
    try {
      valid = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (!/^https?:$/.test(valid.protocol)) throw new Error();
    } catch {
      toast.error("Adresse invalide : collez l’URL complète de votre site.");
      return;
    }
    setBusy(true);
    try {
      // Démo : contenu d’exemple analysé par le même pipeline que le futur
      // extracteur réel. Les données affichées ne viennent PAS du site.
      await new Promise((r) => setTimeout(r, 1200));
      const outcome = await analyzeText(DEMO_CONTENT);
      toast.info(
        "Extraction réelle bientôt disponible : voici une démonstration du parcours avec un contenu d’exemple."
      );
      onAnalyzed(valid.toString(), outcome);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl bg-card p-6 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25">
            <Globe className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">
              L’adresse de votre site
            </h2>
            <p className="text-sm text-muted-foreground">
              Seules les informations publiques seront lues.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <strong>Mode démonstration</strong> — l’extraction réelle de votre
          site sera branchée prochainement. Cette étape illustre le parcours
          avec un contenu d’exemple.
        </div>

        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://pacificrentclean.com"
          className="mt-4"
          aria-label="URL du site"
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
        />
        <Button
          type="button"
          onClick={() => void run()}
          disabled={busy || !url.trim()}
          className="mt-4 h-10 w-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Lecture du site…
            </>
          ) : (
            "Importer mon site"
          )}
        </Button>
      </div>
    </div>
  );
}
