"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { archiveCustomer, unarchiveCustomer } from "@/server/actions/customers";

/** Archiver / restaurer un client, avec confirmation. */
export function CustomerActions({
  customerId,
  customerName,
  archived,
}: {
  customerId: string;
  customerName: string;
  archived: boolean;
}) {
  const router = useRouter();

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
          const result = await unarchiveCustomer(customerId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Client restauré");
          router.refresh();
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
        const result = await archiveCustomer(customerId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Client archivé");
        router.refresh();
      }}
    />
  );
}
