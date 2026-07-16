"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CircleCheck, Copy, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  archiveEquipment,
  duplicateEquipment,
  setEquipmentStatus,
  unarchiveEquipment,
} from "@/server/actions/equipment";
import type { EquipmentStatus } from "@/lib/types/database";

// Actions de la fiche matériel : dupliquer, maintenance, archiver/restaurer.
export function EquipmentActions({
  equipmentId,
  name,
  status,
  archived,
}: {
  equipmentId: string;
  name: string;
  status: EquipmentStatus;
  archived: boolean;
}) {
  const router = useRouter();
  const [duplicating, startDuplicate] = useTransition();
  const [statusPending, startStatusChange] = useTransition();
  const [statusOpen, setStatusOpen] = useState(false);
  const [note, setNote] = useState("");

  const toMaintenance = status !== "maintenance";

  const handleDuplicate = () => {
    startDuplicate(async () => {
      const result = await duplicateEquipment(equipmentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Matériel dupliqué");
      router.push(`/equipment/${result.data.equipmentId}`);
      router.refresh();
    });
  };

  const handleStatusChange = () => {
    startStatusChange(async () => {
      const result = await setEquipmentStatus({
        equipmentId,
        status: toMaintenance ? "maintenance" : "available",
        note,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        toMaintenance
          ? "Matériel mis en maintenance"
          : "Matériel remis disponible"
      );
      setNote("");
      setStatusOpen(false);
      router.refresh();
    });
  };

  const handleArchive = async () => {
    const result = await archiveEquipment(equipmentId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Matériel archivé");
    router.refresh();
  };

  const handleUnarchive = async () => {
    const result = await unarchiveEquipment(equipmentId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Matériel restauré");
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={duplicating}
        onClick={handleDuplicate}
      >
        <Copy aria-hidden />
        {duplicating ? "Duplication…" : "Dupliquer"}
      </Button>

      {!archived && (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStatusOpen(true)}
          >
            {toMaintenance ? (
              <>
                <Wrench aria-hidden />
                Mettre en maintenance
              </>
            ) : (
              <>
                <CircleCheck aria-hidden />
                Remettre disponible
              </>
            )}
          </Button>

          <AlertDialog open={statusOpen} onOpenChange={setStatusOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {toMaintenance
                    ? "Mettre en maintenance ?"
                    : "Remettre disponible ?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {toMaintenance
                    ? `« ${name} » ne pourra plus être réservé tant qu'il sera en maintenance.`
                    : `« ${name} » redeviendra réservable immédiatement.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 text-left">
                <Label htmlFor="status-note">Note (facultatif)</Label>
                <Textarea
                  id="status-note"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    toMaintenance
                      ? "Ex. : remplacement du flexible haute pression"
                      : "Ex. : réparation terminée"
                  }
                  maxLength={1000}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={statusPending}>
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={statusPending}
                  onClick={handleStatusChange}
                >
                  {statusPending
                    ? "En cours…"
                    : toMaintenance
                      ? "Mettre en maintenance"
                      : "Remettre disponible"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                className="text-red-600 hover:text-red-700"
              >
                <Archive aria-hidden />
                Archiver
              </Button>
            }
            title="Archiver ce matériel ?"
            description={`« ${name} » n'apparaîtra plus dans le parc actif. L'historique de ses réservations est conservé.`}
            confirmLabel="Archiver"
            destructive
            onConfirm={handleArchive}
          />
        </>
      )}

      {archived && (
        <ConfirmDialog
          trigger={
            <Button type="button" variant="outline">
              <ArchiveRestore aria-hidden />
              Restaurer
            </Button>
          }
          title="Restaurer ce matériel ?"
          description={`« ${name} » réapparaîtra dans le parc actif.`}
          confirmLabel="Restaurer"
          onConfirm={handleUnarchive}
        />
      )}
    </div>
  );
}
