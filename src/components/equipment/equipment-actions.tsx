"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CircleCheck, Copy, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  archiveEquipment,
  duplicateEquipment,
  setEquipmentStatus,
  unarchiveEquipment,
} from "@/lib/services/equipment-service";
import type { EquipmentStatus } from "@/lib/types/database";

// Actions de la fiche matériel : dupliquer, maintenance, archiver/restaurer.
// Les mutations passent par le service ; l'UI se rafraîchit via
// l'abonnement du provider (pas de router.refresh nécessaire).
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
  const { provider } = useAppData();
  const [duplicating, startDuplicate] = useTransition();

  const toMaintenance = status !== "maintenance";

  const handleDuplicate = () => {
    startDuplicate(async () => {
      const result = await duplicateEquipment(equipmentId, provider);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Matériel dupliqué");
      router.push(`/equipment/${result.data.equipmentId}`);
    });
  };

  const handleStatusChange = async () => {
    const result = await setEquipmentStatus(
      equipmentId,
      toMaintenance ? "maintenance" : "available",
      provider
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      toMaintenance
        ? "Matériel mis en maintenance"
        : "Matériel remis disponible"
    );
  };

  const handleArchive = async () => {
    const result = await archiveEquipment(equipmentId, provider);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Matériel archivé");
  };

  const handleUnarchive = async () => {
    const result = await unarchiveEquipment(equipmentId, provider);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Matériel restauré");
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
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline">
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
            }
            title={
              toMaintenance
                ? "Mettre en maintenance ?"
                : "Remettre disponible ?"
            }
            description={
              toMaintenance
                ? `« ${name} » ne pourra plus être réservé tant qu'il sera en maintenance.`
                : `« ${name} » redeviendra réservable immédiatement.`
            }
            confirmLabel={
              toMaintenance ? "Mettre en maintenance" : "Remettre disponible"
            }
            onConfirm={handleStatusChange}
          />

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
