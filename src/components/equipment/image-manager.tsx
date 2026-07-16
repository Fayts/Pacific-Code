"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  addEquipmentImage,
  deleteEquipmentImage,
} from "@/server/actions/equipment";
import { equipmentImageUrl } from "@/lib/core/storage";
import type { EquipmentImage } from "@/lib/types/database";

// Gestion des photos d'un matériel existant : grille, ajout, suppression.
export function ImageManager({
  equipmentId,
  images,
}: {
  equipmentId: string;
  images: EquipmentImage[];
}) {
  const router = useRouter();
  const [uploading, startUpload] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    startUpload(async () => {
      const formData = new FormData();
      formData.append("equipmentId", equipmentId);
      formData.append("image", file);
      // La première photo devient automatiquement la photo principale.
      formData.append("isPrimary", images.length === 0 ? "true" : "false");
      const result = await addEquipmentImage(formData);
      if (inputRef.current) inputRef.current.value = "";
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Photo ajoutée");
      router.refresh();
    });
  };

  const handleDelete = async (imageId: string) => {
    const result = await deleteEquipmentImage(imageId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Photo supprimée");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
        <CardDescription>PNG, JPG ou WebP, 5 Mo maximum.</CardDescription>
        <CardAction>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => handleFileChange(event.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus aria-hidden />
            {uploading ? "Envoi…" : "Ajouter une photo"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Aucune photo pour le moment.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="group relative overflow-hidden rounded-md border border-neutral-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={equipmentImageUrl(image.storage_path)}
                  alt="Photo du matériel"
                  className="aspect-square w-full object-cover"
                />
                {image.is_primary && (
                  <span className="absolute top-1.5 left-1.5 rounded bg-sky-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Principale
                  </span>
                )}
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-white"
                      aria-label="Supprimer la photo"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  }
                  title="Supprimer cette photo ?"
                  description="La photo sera définitivement supprimée."
                  confirmLabel="Supprimer"
                  destructive
                  onConfirm={() => handleDelete(image.id)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
