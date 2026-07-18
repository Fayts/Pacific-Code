"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Confirmation avant action sensible. Le bouton déclencheur est passé via
// `trigger` ; onConfirm est attendu avant fermeture (anti double-clic).
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmer",
  destructive = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        nativeButton={false}
        render={<span className="contents" />}
      >
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={
              destructive
                ? "bg-destructive text-white hover:bg-destructive/90"
                : undefined
            }
            onClick={(event) => {
              event.preventDefault();
              startTransition(async () => {
                await onConfirm();
                setOpen(false);
              });
            }}
          >
            {pending ? "En cours…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
