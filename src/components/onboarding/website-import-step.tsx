"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Globe, Loader2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  analyzeFacebookPage,
  analyzeText,
  analyzeWebsite,
  type AnalyzeOutcome,
} from "@/lib/import/ai";
import type { ChannelConnection } from "@/lib/types/inbox";
import { cn } from "@/lib/utils";

// Import automatique des informations publiques du loueur : depuis son
// site web (lecture serveur réelle) ou depuis sa Page Facebook connectée
// (fiche + publications). En mode mock (démo publique), le parcours reste
// illustré avec un contenu d'exemple clairement signalé.

const DEMO_CONTENT = `Pacific Rent & Clean — location de matériel et de véhicules à Tahiti.
Nous proposons 2 Kärcher Puzzi 10/1 à 7 990 XPF par jour et un Kärcher Puzzi 8/1 à 6 990 XPF par jour. Une caution de 20 000 XPF est demandée pour le matériel.
La livraison est gratuite entre Papenoo et Papeete.`;

type SourceTab = "website" | "facebook";

export function WebsiteImportStep({
  onAnalyzed,
}: {
  onAnalyzed: (raw: string, outcome: AnalyzeOutcome) => void;
}) {
  const { provider } = useAppData();
  const realMode = provider.kind === "supabase";

  const [tab, setTab] = useState<SourceTab>("website");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [messengerConnection, setMessengerConnection] =
    useState<ChannelConnection | null>(null);
  const [connectionLoaded, setConnectionLoaded] = useState(false);

  useEffect(() => {
    if (!realMode) return;
    let cancelled = false;
    void provider.channels.list().then((connections) => {
      if (cancelled) return;
      setMessengerConnection(
        connections.find(
          (c) => c.channel === "messenger" && c.status === "connected"
        ) ?? null
      );
      setConnectionLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, realMode]);

  const parseUrl = (): URL | null => {
    try {
      const valid = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (!/^https?:$/.test(valid.protocol)) throw new Error();
      return valid;
    } catch {
      toast.error("Adresse invalide : collez l’URL complète de votre site.");
      return null;
    }
  };

  const runWebsite = async () => {
    const valid = parseUrl();
    if (!valid) return;
    setBusy(true);
    try {
      if (!realMode) {
        // Démo publique : contenu d'exemple, jamais présenté comme réel.
        await new Promise((r) => setTimeout(r, 1200));
        const outcome = await analyzeText(DEMO_CONTENT);
        toast.info(
          "Version de démonstration : voici le parcours avec un contenu d’exemple."
        );
        onAnalyzed(valid.toString(), outcome);
        return;
      }
      const token = (await provider.getAccessToken?.()) ?? null;
      const outcome = await analyzeWebsite(valid.toString(), token);
      toast.success(
        `${outcome.pagesRead} page${outcome.pagesRead > 1 ? "s" : ""} lue${
          outcome.pagesRead > 1 ? "s" : ""
        } — vérifiez ce qui a été détecté avant l’import.`
      );
      onAnalyzed(valid.toString(), outcome);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Lecture du site impossible — réessayez."
      );
    } finally {
      setBusy(false);
    }
  };

  const runFacebook = async () => {
    setBusy(true);
    try {
      const token = (await provider.getAccessToken?.()) ?? null;
      const outcome = await analyzeFacebookPage(token);
      if (outcome.website) {
        toast.info(
          `Site web détecté sur votre Page : ${outcome.website} — vous pourrez aussi l’importer depuis « Site web ».`
        );
      }
      toast.success(
        `Informations de « ${outcome.pageName ?? "votre Page"} » récupérées${
          outcome.items.length > 0
            ? ` — ${outcome.items.length} bien${outcome.items.length > 1 ? "s" : ""} détecté${outcome.items.length > 1 ? "s" : ""} dans vos publications`
            : ""
        }.`
      );
      onAnalyzed(`Page Facebook — ${outcome.pageName ?? ""}`, outcome);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Lecture de la Page impossible — réessayez."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {realMode && (
        <div
          role="tablist"
          aria-label="Source de l’import"
          className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1"
        >
          {(
            [
              { id: "website", icon: Globe, label: "Site web" },
              { id: "facebook", icon: MessagesSquare, label: "Page Facebook" },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            const active = tab === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(option.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {(!realMode || tab === "website") && (
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
                Seules les informations publiques sont lues — la page
                d’accueil et vos pages tarifs ou catalogue.
              </p>
            </div>
          </div>

          {!realMode && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <strong>Mode démonstration</strong> — sur la version complète,
              votre site est réellement lu. Cette démo illustre le parcours
              avec un contenu d’exemple.
            </div>
          )}

          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://pacificrentclean.com"
            className="mt-4"
            aria-label="URL du site"
            onKeyDown={(e) => {
              if (e.key === "Enter") void runWebsite();
            }}
          />
          <Button
            type="button"
            onClick={() => void runWebsite()}
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
          {realMode && (
            <p className="mt-3 text-xs text-muted-foreground">
              La lecture prend quelques secondes ; tout est vérifiable avant
              l’import. Site en images ou indisponible ? Utilisez la méthode
              « brochure ou photo ».
            </p>
          )}
        </div>
      )}

      {realMode && tab === "facebook" && (
        <div className="rounded-2xl bg-card p-6 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-lagoon/25">
              <MessagesSquare className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">
                Votre Page Facebook
              </h2>
              <p className="text-sm text-muted-foreground">
                Fiche de la Page (nom, téléphone, adresse…) et biens détectés
                dans vos publications récentes.
              </p>
            </div>
          </div>

          {!connectionLoaded ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Vérification de votre connexion Facebook…
            </div>
          ) : messengerConnection ? (
            <>
              <div className="mt-4 rounded-lg border border-pc-turquoise/30 bg-pc-turquoise/[0.06] px-3 py-2 text-sm text-foreground">
                Page connectée :{" "}
                <strong>
                  {messengerConnection.display_name ?? "votre Page"}
                </strong>
              </div>
              <Button
                type="button"
                onClick={() => void runFacebook()}
                disabled={busy}
                className="mt-4 h-10 w-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Lecture de la Page…
                  </>
                ) : (
                  "Récupérer les informations de ma Page"
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-muted-foreground">
                Aucune Page connectée pour l’instant. Connectez votre Page en
                un clic (bouton « Accepter » côté Facebook), puis revenez ici.
              </p>
              <Button
                variant="outline"
                className="mt-4 w-full"
                render={<Link href="/assistant/connections" />}
              >
                Connecter ma Page Facebook
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
