"use client";

import { toast } from "sonner";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAppData } from "@/components/providers/app-data-provider";
import {
  archiveCustomer,
  unarchiveCustomer,
} from "@/lib/services/customer-service";

/**
 * Archiver / restaurer un client, avec confirmation. Les mutations
 * passent par le service ; l'UI se rafraîchit via l'abonnement du
 * provider (pas de router.refresh nécessaire).
 */
export function CustomerActions({
  customerId,
  customerName,
  archived,
}: {
  customerId: string;
  customerName: string;
  archived: boolean;
}) {
  const { provider } = useAppData();

  if (archived) {
    return (
      <ConfirmDialog
        trigger={
          <Button variant="outline">
            <ArchiveRestore aria-hidden />
            Restaurer
          </Button>
        }
        title="Restaurer ce client ?"
        description={`${customerName} redeviendra visible dans votre liste de clients.`}
        confirmLabel="Restaurer"
        onConfirm={async () => {
          const result = await unarchiveCustomer(customerId, provider);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Client restauré");
        }}
      />
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="outline"
          className="text-red-700 hover:bg-red-50 hover:text-red-800"
        >
          <Archive aria-hidden />
          Archiver
        </Button>
      }
      title="Archiver ce client ?"
      description={`${customerName} n'apparaîtra plus dans votre liste de clients. Son historique de réservations est conservé et vous pourrez le restaurer à tout moment.`}
      confirmLabel="Archiver"
      destructive
      onConfirm={async () => {
        const result = await archiveCustomer(customerId, provider);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Client archivé");
      }}
    />
  );
}
