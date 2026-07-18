"use client";

// Zone de démonstration : restaure le jeu de données fictives d'origine
// (matériels, clients, réservations). La session reste ouverte.

import { useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAppData } from "@/components/providers/app-data-provider";

export function DemoDataCard() {
  const { provider } = useAppData();
  const [pending, startTransition] = useTransition();

  const handleReset = () => {
    startTransition(async () => {
      await provider.resetDemoData();
      toast.success("Données de démonstration restaurées");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Données de démonstration</CardTitle>
        <CardDescription>
          Cette version fonctionne sur des données fictives enregistrées dans
          votre navigateur. Vous pouvez repartir du jeu de données d&apos;origine
          à tout moment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline" disabled={pending}>
              <RotateCcw aria-hidden />
              {pending ? "Réinitialisation…" : "Réinitialiser les données de démo"}
            </Button>
          }
          title="Réinitialiser les données de démonstration ?"
          description="Tous vos ajouts et modifications (matériels, clients, réservations, paramètres) seront remplacés par le jeu de données fictives d'origine. Votre session reste ouverte."
          confirmLabel="Réinitialiser"
          destructive
          onConfirm={handleReset}
        />
      </CardContent>
    </Card>
  );
}
