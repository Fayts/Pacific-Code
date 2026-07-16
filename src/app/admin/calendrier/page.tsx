import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shell";
import { Card, cn } from "@/components/ui";
import { BOOKINGS, getItem, TODAY_ISO } from "@/lib/data";

export const metadata: Metadata = { title: "Calendrier" };

/* Mois affiché par la maquette : juillet 2026 */
const YEAR = 2026;
const MONTH = 6; // juillet (index 0)
const DAYS_IN_MONTH = 31;
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function isoFor(day: number): string {
  return `${YEAR}-${String(MONTH + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarPage() {
  // Décalage du 1er du mois dans une semaine commençant le lundi
  const firstWeekday = new Date(Date.UTC(YEAR, MONTH, 1)).getUTCDay(); // 0 = dim
  const offset = (firstWeekday + 6) % 7;

  const bookingsByDay = new Map<string, typeof BOOKINGS>();
  for (const b of BOOKINGS) {
    if (b.status === "annulee") continue;
    const list = bookingsByDay.get(b.date) ?? [];
    bookingsByDay.set(b.date, [...list, b]);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <>
      <AdminPageHeader
        title="Calendrier"
        description="Vue mensuelle des locations et prestations planifiées."
        action={
          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-mist-300 bg-white p-2 text-navy-400"
              aria-label="Mois précédent (démo)"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-32 text-center text-sm font-semibold text-navy-900">
              Juillet 2026
            </span>
            <button
              className="rounded-full border border-mist-300 bg-white p-2 text-navy-400"
              aria-label="Mois suivant (démo)"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      <Card className="overflow-x-auto p-4">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map((d) => (
              <p
                key={d}
                className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-navy-400"
              >
                {d}
              </p>
            ))}
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="min-h-24 rounded-xl bg-mist-50" />;
              }
              const iso = isoFor(day);
              const dayBookings = bookingsByDay.get(iso) ?? [];
              const isToday = iso === TODAY_ISO;
              return (
                <div
                  key={iso}
                  className={cn(
                    "min-h-24 rounded-xl border p-2",
                    isToday
                      ? "border-lagoon-500 bg-lagoon-50"
                      : "border-mist-200 bg-white"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      isToday ? "text-lagoon-700" : "text-navy-500"
                    )}
                  >
                    {day}
                    {isToday ? " · aujourd'hui" : ""}
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {dayBookings.map((b) => {
                      const item = getItem(b.itemSlug)!;
                      const isLocation = item.category === "location";
                      return (
                        <Link
                          key={b.id}
                          href={`/admin/reservations/${b.id}`}
                          className={cn(
                            "block truncate rounded-md px-1.5 py-1 text-[11px] font-medium leading-tight",
                            isLocation
                              ? "bg-navy-100 text-navy-800 hover:bg-navy-200"
                              : "bg-lagoon-100 text-lagoon-800 hover:bg-lagoon-200"
                          )}
                        >
                          {b.timeSlot.slice(0, 5)} · {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="mt-4 flex items-center gap-5 text-xs text-navy-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-navy-200" /> Location de matériel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-lagoon-200" /> Prestation à domicile
        </span>
      </div>
    </>
  );
}
