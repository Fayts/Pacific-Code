import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/shell";
import { AdminTable } from "@/components/admin/booking-bits";
import { Button, Input } from "@/components/ui";
import { CUSTOMERS } from "@/lib/data";
import { formatDateShort, formatXPF, initials } from "@/lib/format";

export const metadata: Metadata = { title: "Clients" };

export default function CustomersPage() {
  return (
    <>
      <AdminPageHeader
        title="Clients"
        description={`${CUSTOMERS.length} clients enregistrés`}
        action={<Button variant="accent" size="sm">+ Nouveau client</Button>}
      />

      <div className="mb-4 max-w-sm">
        <Input placeholder="Rechercher un client… (démo)" />
      </div>

      <AdminTable
        headers={["Client", "Contact", "Commune", "Réservations", "Total dépensé", "Inscrit le"]}
      >
        {CUSTOMERS.map((c) => (
          <tr key={c.id} className="hover:bg-mist-50">
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lagoon-100 text-xs font-semibold text-lagoon-800">
                  {initials(c.firstName, c.lastName)}
                </span>
                <span className="font-medium text-navy-900">
                  {c.firstName} {c.lastName}
                </span>
              </div>
            </td>
            <td className="px-4 py-3 text-navy-600">
              {c.email}
              <span className="block text-xs text-navy-400">{c.phone}</span>
            </td>
            <td className="px-4 py-3 text-navy-600">{c.commune}</td>
            <td className="px-4 py-3 text-navy-600">{c.bookingsCount}</td>
            <td className="px-4 py-3 font-medium text-navy-900">
              {formatXPF(c.totalSpent)}
            </td>
            <td className="px-4 py-3 text-navy-600">{formatDateShort(c.createdAt)}</td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
