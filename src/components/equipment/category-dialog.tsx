"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/components/providers/app-data-provider";
import { createCategory } from "@/lib/services/equipment-service";

// Création rapide d'une catégorie depuis le formulaire matériel.
export function CategoryDialog({
  onCreated,
}: {
  onCreated: (category: { id: string; name: string }) => void;
}) {
  const { provider } = useAppData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createCategory(
        { name: trimmed, description },
        provider
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Catégorie créée");
      onCreated({ id: result.data.categoryId, name: trimmed });
      setName("");
      setDescription("");
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="xs" className="text-primary" />
        }
      >
        <Plus aria-hidden />
        Nouvelle catégorie
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle catégorie</DialogTitle>
          <DialogDescription>
            Regroupez vos matériels par famille (nettoyage, jardin, véhicules…).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Nom</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. : Nettoyage haute pression"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description (facultatif)</Label>
            <Textarea
              id="category-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Annuler
          </DialogClose>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={pending || !name.trim()}
          >
            {pending ? "Création…" : "Créer la catégorie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
