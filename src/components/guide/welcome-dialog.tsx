"use client";

// Proposition de visite guidée — uniquement à la première connexion.
// Quel que soit le choix, elle ne se re-propose jamais d'elle-même
// (le centre d'aide « ? » permet de la lancer plus tard).

import { Compass } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGuide } from "@/components/guide/guide-provider";

export function GuideWelcomeDialog() {
  const guide = useGuide();
  const open = guide.status === "unseen";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) guide.declineWelcome();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-turquoise/30">
            <Compass className="size-7" aria-hidden />
          </span>
          <DialogTitle className="mt-3 text-xl">Bienvenue 👋</DialogTitle>
          <DialogDescription className="text-balance">
            Découvrez où tout se trouve en moins d’une minute — une visite
            rapide, sans aucune saisie, que vous pouvez quitter à tout moment.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-2">
          <Button
            onClick={guide.start}
            className="h-10 w-full bg-gradient-to-r from-pc-lagoon to-pc-turquoise font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
          >
            Démarrer la visite
          </Button>
          <Button variant="ghost" onClick={guide.declineWelcome}>
            Plus tard
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground/70">
          Disponible à tout moment depuis le bouton «&nbsp;?&nbsp;» en haut de
          l’écran.
        </p>
      </DialogContent>
    </Dialog>
  );
}
