"use client";

// Centre d'aide permanent (topbar) : relancer la visite, accès rapides,
// raccourcis clavier.

import { useState } from "react";
import Link from "next/link";
import {
  CircleHelp,
  Compass,
  ExternalLink,
  Keyboard,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGuide } from "@/components/guide/guide-provider";

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl + I", "Importer / mettre à jour l'activité"],
  ["← / →", "Naviguer dans la visite guidée"],
  ["Échap", "Fermer les fenêtres et quitter la visite"],
  ["Entrée", "Envoyer un message à l'assistant"],
];

export function HelpMenu() {
  const guide = useGuide();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Centre d'aide"
              data-guide="help-menu"
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <CircleHelp className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={guide.restart}>
            <Compass className="size-4" aria-hidden />
            {guide.status === "completed" || guide.status === "dismissed"
              ? "Revoir la visite guidée"
              : "Lancer la visite guidée"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/onboarding" />}>
            <Upload className="size-4" aria-hidden />
            Importer / mettre à jour
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/reserver/apercu" />}>
            <ExternalLink className="size-4" aria-hidden />
            Mon espace de réservation
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="size-4" aria-hidden />
            Raccourcis clavier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Raccourcis clavier</DialogTitle>
            <DialogDescription>
              Quelques gestes pour aller plus vite.
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-1 space-y-2.5">
            {SHORTCUTS.map(([keys, label]) => (
              <li
                key={keys}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-muted-foreground">{label}</span>
                <kbd className="rounded-md border border-border bg-muted px-2 py-0.5 font-sans text-xs font-medium text-foreground">
                  {keys}
                </kbd>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
