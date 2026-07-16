import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/shell";
import { AdminTable, PaymentBadge } from "@/components/admin/booking-bits";
import { Card } from "@/components/ui";
import { BOOKINGS, getCustomer, getItem } from "@/lib/data";
import { formatDateShort, formatXPF } from "@/lib/format";

export const metadata: Metadata = { title: "Paiements" };

export default function PaymentsPage() {
  const paid = BOOKINGS.filter((b) => b.paymentStatus === "paye");
  const pending = BOOKINGS.filter(
    (b) => b.paymentStatus === "en_attente" && b.status !== "annulee"
  );
  const totalPaid = paid.reduce((sum, b) => sum + b.total, 0);
  const totalPending = pending.reduce((sum, b) => sum + b.total, 0);

  const rows = [...BOOKINGS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <AdminPageHeader
        title="Paiements"
        description="Suivi des encaissements — le paiement en ligne réel sera branché plus tard."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-navy-500">Encaissé (mois en cours)</p>
          <p className="mt-1 text-2xl font-semibold text-navy-900">
            {formatXPF(totalPaid)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-navy-500">En attente</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">
            {formatXPF(totalPending)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-navy-500">Transactions</p>
          <p className="mt-1 text-2xl font-semibold text-navy-900">
            {BOOKINGS.length}
          </p>
        </Card>
      </div>

      <AdminTable
        headers={["Réservation", "Client", "Produit", "Date", "Moyen", "Statut", "Montant"]}
      >
        {rows.map((b) => {
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
              <td className="px-4 py-3 text-navy-600">{b.paymentMethod}</td>
              <td className="px-4 py-3"><PaymentBadge status={b.paymentStatus} /></td>
              <td className="px-4 py-3 font-medium text-navy-900">
                {formatXPF(b.total)}
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </>
  );
}
