import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  TrendingUp,
  Truck,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shell";
import { AdminTable, PaymentBadge, StatusBadge } from "@/components/admin/booking-bits";
import { Card } from "@/components/ui";
import {
  BOOKINGS,
  DELIVERY_TOUR,
  getBooking,
  getCustomer,
  getItem,
  TODAY_ISO,
} from "@/lib/data";
import { formatDateShort, formatXPF } from "@/lib/format";

/* Chiffres fictifs du mois en cours (juillet 2026) */
const STATS = [
  {
    label: "Chiffre d'affaires — juillet",
    value: formatXPF(186400),
    delta: "+12 % vs juin",
    icon: TrendingUp,
  },
  {
    label: "Réservations du mois",
    value: "14",
    delta: "+3 vs juin",
    icon: ClipboardList,
  },
  {
    label: "En attente de confirmation",
    value: "2",
    delta: "à traiter aujourd'hui",
    icon: CalendarClock,
  },
  {
    label: "Livraisons aujourd'hui",
    value: String(DELIVERY_TOUR.length),
    delta: "tournée de 16 km",
    icon: Truck,
  },
];

/* Réservations par jour — 14 derniers jours (données fictives) */
const DAILY = [
  { day: "03/07", count: 1 },
  { day: "04/07", count: 2 },
  { day: "05/07", count: 0 },
  { day: "06/07", count: 1 },
  { day: "07/07", count: 1 },
  { day: "08/07", count: 2 },
  { day: "09/07", count: 1 },
  { day: "10/07", count: 2 },
  { day: "11/07", count: 1 },
  { day: "12/07", count: 3 },
  { day: "13/07", count: 0 },
  { day: "14/07", count: 2 },
  { day: "15/07", count: 1 },
  { day: "16/07", count: 2 },
];

const CHART_COLOR = "#0d9aad"; // validé (contraste + chroma) sur fond blanc

export default function AdminDashboard() {
  const maxCount = Math.max(...DAILY.map((d) => d.count));
  const upcoming = BOOKINGS.filter((b) =>
    ["en_attente", "confirmee", "en_cours"].includes(b.status)
  ).slice(0, 6);

  return (
    <>
      <AdminPageHeader
        title="Tableau de bord"
        description={`Aperçu du jour — ${formatDateShort(TODAY_ISO)} (Pacific/Tahiti)`}
      />

      {/* Tuiles de statistiques */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-navy-500">{stat.label}</p>
              <stat.icon size={18} className="text-lagoon-600" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-navy-900">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-navy-400">{stat.delta}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Graphique : réservations par jour */}
        <Card className="p-6">
          <h2 className="font-semibold text-navy-900">
            Réservations par jour — 14 derniers jours
          </h2>
          <div className="mt-6 flex h-44 items-end gap-1.5">
            {DAILY.map((d) => (
              <div
                key={d.day}
                className="group relative flex h-full flex-1 flex-col justify-end"
                title={`${d.day} : ${d.count} réservation${d.count > 1 ? "s" : ""}`}
              >
                {/* Étiquette directe sur le maximum uniquement */}
                {d.count === maxCount ? (
                  <span className="mb-1 text-center text-xs font-medium text-navy-700">
                    {d.count}
                  </span>
                ) : null}
                <div
                  className="w-full rounded-t transition-opacity group-hover:opacity-80"
                  style={{
                    backgroundColor: d.count > 0 ? CHART_COLOR : "#e6ebf2",
                    height: d.count > 0 ? `${(d.count / maxCount) * 82}%` : "3px",
                  }}
                />
                <span className="absolute -bottom-5 left-1/2 hidden -translate-x-1/2 text-[10px] text-navy-400 sm:block">
                  {d.day.slice(0, 2)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-navy-400">
            Du 3 au 16 juillet · survolez une barre pour le détail
          </p>
        </Card>

        {/* Tournée du jour */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Tournée du jour</h2>
            <Link
              href="/admin/livraisons"
              className="inline-flex items-center gap-1 text-sm font-medium text-lagoon-600 hover:text-lagoon-700"
            >
              Tout voir <ArrowUpRight size={14} />
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {DELIVERY_TOUR.map((stop) => {
              const booking = getBooking(stop.bookingId)!;
              const customer = getCustomer(booking.customerId)!;
              const item = getItem(booking.itemSlug)!;
              return (
                <li
                  key={stop.bookingId + stop.type}
                  className="rounded-xl border border-mist-200 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-navy-900">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <span className="text-xs font-medium text-lagoon-700">
                      {stop.window}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-navy-500">
                    {stop.type === "livraison" ? "Livraison" : "Récupération"} ·{" "}
                    {item.name} · {booking.commune ?? "Dépôt"}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Prochaines réservations */}
      <Card className="mt-6 overflow-hidden border-0 bg-transparent shadow-none">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Réservations à venir</h2>
          <Link
            href="/admin/reservations"
            className="inline-flex items-center gap-1 text-sm font-medium text-lagoon-600 hover:text-lagoon-700"
          >
            Toutes les réservations <ArrowUpRight size={14} />
          </Link>
        </div>
        <AdminTable
          headers={["Référence", "Client", "Produit", "Date", "Statut", "Paiement", "Total"]}
        >
          {upcoming.map((b) => {
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
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3"><PaymentBadge status={b.paymentStatus} /></td>
                <td className="px-4 py-3 font-medium text-navy-900">
                  {formatXPF(b.total)}
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </Card>
    </>
  );
}
