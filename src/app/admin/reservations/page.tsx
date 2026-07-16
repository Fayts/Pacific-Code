import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/shell";
import { AdminTable, PaymentBadge, StatusBadge } from "@/components/admin/booking-bits";
import { Badge, Button } from "@/components/ui";
import { BOOKINGS, getCustomer, getItem } from "@/lib/data";
import { formatDateShort, formatXPF } from "@/lib/format";

export const metadata: Metadata = { title: "Réservations" };

const FILTERS = ["Toutes", "En attente", "Confirmées", "En cours", "Terminées", "Annulées"];

export default function BookingsPage() {
  const sorted = [...BOOKINGS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <AdminPageHeader
        title="Réservations"
        description={`${BOOKINGS.length} réservations — filtres visuels (démo)`}
        action={<Button variant="accent" size="sm">+ Nouvelle réservation</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <Badge
            key={f}
            tone={i === 0 ? "navy" : "gray"}
            className="cursor-pointer px-3.5 py-1.5 text-sm"
          >
            {f}
          </Badge>
        ))}
      </div>

      <AdminTable
        headers={[
          "Référence",
          "Client",
          "Produit",
          "Date",
          "Mode",
          "Statut",
          "Paiement",
          "Total",
        ]}
      >
        {sorted.map((b) => {
          const customer = getCustomer(b.customerId)!;
          const item = getItem(b.itemSlug)!;
          return (
            <tr key={b.id} className="hover:bg-mist-50">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/reservations/${b.id}`}
                  className="font-medium text-lagoon-700 hover:underline"
                >
                  {b.reference}
                </Link>
              </td>
              <td className="px-4 py-3 text-navy-800">
                {customer.firstName} {customer.lastName}
              </td>
              <td className="px-4 py-3 text-navy-600">{item.name}</td>
              <td className="px-4 py-3 text-navy-600">{formatDateShort(b.date)}</td>
              <td className="px-4 py-3 text-navy-600">
                {b.mode === "livraison" ? `Livraison · ${b.commune}` : "Retrait"}
              </td>
              <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
              <td className="px-4 py-3"><PaymentBadge status={b.paymentStatus} /></td>
              <td className="px-4 py-3 font-medium text-navy-900">{formatXPF(b.total)}</td>
            </tr>
          );
        })}
      </AdminTable>
    </>
  );
}
