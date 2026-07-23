// Exécuteurs de l'assistant branchés sur la couche Repository (mode
// mock) : mêmes contrats que les outils du mode LLM, mais aucune base de
// données. La confirmation des propositions repasse par les services
// habituels (revalidation complète, disponibilité comprise).

import type { DataProvider } from "@/lib/data/repositories";
import type { Organization } from "@/lib/types/database";
import type { DemoToolkit } from "@/lib/ai/demo";
import type { BookingProposal } from "@/lib/ai/proposals";
import {
  parseLocalDateTimeInput,
  toLocalDateTimeInput,
} from "@/lib/core/dates";
import {
  computeBookingTotals,
  computeDurationDays,
  requiredMinRentalDays,
} from "@/lib/core/pricing";
import { formatCustomerName, formatMoney } from "@/lib/core/format";
import {
  BOOKING_STATUS,
  EQUIPMENT_STATUS,
  derivedBookingStatus,
} from "@/lib/core/labels";

const LIST_LIMIT = 25;

/** Comparaison insensible à la casse et aux accents. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function createDemoToolkit(
  provider: DataProvider,
  organization: Organization
): DemoToolkit {
  const timezone = organization.timezone;
  const currency = organization.currency;

  return {
    executors: {
      async searchEquipment(input) {
        const term = normalize(input.query ?? "");
        return (await provider.equipment.list())
          .filter(
            (e) =>
              !term ||
              normalize(e.name).includes(term) ||
              normalize(e.internal_ref ?? "").includes(term)
          )
          .filter(
            (e) => !input.status || input.status === "all" || e.status === input.status
          )
          .slice(0, LIST_LIMIT)
          .map((e) => ({
            id: e.id,
            name: e.name,
            reference: e.internal_ref,
            dailyPrice: e.daily_price,
            pricingMode: e.pricing_mode,
            deposit: e.deposit_amount,
            quantity: e.quantity_total,
            status: EQUIPMENT_STATUS[e.status].label,
          }));
      },

      async listAvailability(input) {
        const start = parseLocalDateTimeInput(input.startAt, timezone);
        const end = parseLocalDateTimeInput(input.endAt, timezone);
        const equipment = await provider.equipment.list();
        const rows = [];
        for (const item of equipment) {
          const availability = await provider.bookings.checkAvailability({
            equipmentId: item.id,
            startAtIso: start.toISOString(),
            endAtIso: end.toISOString(),
            quantity: 1,
          });
          rows.push({
            equipmentId: item.id,
            name: item.name,
            status: EQUIPMENT_STATUS[item.status].label,
            total: availability.total_quantity,
            booked: availability.total_quantity - availability.available_quantity,
            available: availability.available_quantity,
          });
        }
        return rows;
      },

      async searchCustomers(input) {
        const term = normalize(input.query);
        if (!term) return [];
        return (await provider.customers.list())
          .filter((c) =>
            [c.first_name, c.last_name, c.company_name, c.email, c.phone]
              .filter(Boolean)
              .some((field) => normalize(String(field)).includes(term))
          )
          .slice(0, 15)
          .map((c) => ({
            id: c.id,
            name: formatCustomerName(c),
            type: c.type,
            email: c.email,
            phone: c.phone,
          }));
      },

      async listBookings(input) {
        const now = new Date();
        const nowIso = now.toISOString();
        let bookings = (await provider.bookings.list()).sort((a, b) =>
          a.start_at.localeCompare(b.start_at)
        );

        switch (input.filter) {
          case "upcoming":
            bookings = bookings.filter(
              (b) =>
                ["pending", "confirmed"].includes(b.status) &&
                b.start_at >= nowIso
            );
            break;
          case "in_progress":
            bookings = bookings.filter((b) => b.status === "in_progress");
            break;
          case "late":
            bookings = bookings.filter(
              (b) => b.status === "in_progress" && b.end_at < nowIso
            );
            break;
          case "pending":
            bookings = bookings.filter((b) => b.status === "pending");
            break;
          case "completed":
            bookings = bookings
              .filter((b) => b.status === "completed")
              .sort((a, b) => b.start_at.localeCompare(a.start_at));
            break;
        }
        if (input.startAt && input.endAt) {
          const start = parseLocalDateTimeInput(input.startAt, timezone);
          const end = parseLocalDateTimeInput(input.endAt, timezone);
          bookings = bookings.filter(
            (b) =>
              b.start_at < end.toISOString() && b.end_at > start.toISOString()
          );
        }

        return bookings.slice(0, LIST_LIMIT).map((b) => ({
          number: b.booking_number,
          status:
            BOOKING_STATUS[derivedBookingStatus(b.status, b.end_at, now)].label,
          customer: b.customer
            ? formatCustomerName(b.customer)
            : "Client inconnu",
          startAt: toLocalDateTimeInput(new Date(b.start_at), timezone),
          endAt: toLocalDateTimeInput(new Date(b.end_at), timezone),
          total: formatMoney(b.total_amount, currency),
          equipment: b.items
            .map(
              (i) =>
                `${i.equipment?.name ?? "?"}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`
            )
            .join(", "),
        }));
      },

      async getStats(input) {
        const start = parseLocalDateTimeInput(input.startAt, timezone);
        const end = parseLocalDateTimeInput(input.endAt, timezone);
        const bookings = (await provider.bookings.list()).filter(
          (b) =>
            !["cancelled", "draft"].includes(b.status) &&
            b.start_at >= start.toISOString() &&
            b.start_at < end.toISOString()
        );

        const revenue = bookings.reduce(
          (sum, b) => sum + (b.total_amount ?? 0),
          0
        );
        const byEquipment = new Map<string, number>();
        for (const b of bookings) {
          for (const item of b.items) {
            const name = item.equipment?.name ?? "Inconnu";
            byEquipment.set(
              name,
              (byEquipment.get(name) ?? 0) + (item.line_total ?? 0)
            );
          }
        }
        const topEquipment = [...byEquipment.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value]) => ({
            name,
            revenue: formatMoney(value, currency),
          }));

        return {
          bookingsCount: bookings.length,
          revenue: formatMoney(revenue, currency),
          topEquipment,
        };
      },

      async proposeBooking(input): Promise<BookingProposal | { error: string }> {
        const start = parseLocalDateTimeInput(input.startAt, timezone);
        const end = parseLocalDateTimeInput(input.endAt, timezone);
        if (end <= start) {
          return { error: "La date de retour doit être après le départ" };
        }

        const customer = await provider.customers.get(input.customerId);
        if (!customer || customer.archived_at) {
          return { error: "Client introuvable" };
        }

        const equipment = await provider.equipment.list();
        const byId = new Map(equipment.map((e) => [e.id, e]));
        for (const item of input.items) {
          if (!byId.get(item.equipmentId)) {
            return { error: "Matériel introuvable" };
          }
        }

        const durationDays = computeDurationDays(start, end);
        const minDays = requiredMinRentalDays(
          input.items.map((i) => byId.get(i.equipmentId)!.min_rental_days)
        );
        if (durationDays < minDays) {
          return { error: `Durée minimale de location : ${minDays} jour(s)` };
        }

        const warnings: string[] = [];
        for (const item of input.items) {
          const availability = await provider.bookings.checkAvailability({
            equipmentId: item.equipmentId,
            startAtIso: start.toISOString(),
            endAtIso: end.toISOString(),
            quantity: item.quantity,
          });
          if (!availability.available) {
            const name = byId.get(item.equipmentId)!.name;
            warnings.push(
              `« ${name} » n'est pas disponible sur cette période (${
                availability.reason === "maintenance"
                  ? "en maintenance"
                  : availability.reason === "conflict"
                    ? "déjà réservé"
                    : "indisponible"
              })`
            );
          }
        }

        const totals = computeBookingTotals({
          items: input.items.map((i) => ({
            dailyPrice: byId.get(i.equipmentId)!.daily_price,
            pricingMode: byId.get(i.equipmentId)!.pricing_mode,
            quantity: i.quantity,
          })),
          durationDays,
        });
        const deposit = input.items.reduce(
          (sum, i) => sum + byId.get(i.equipmentId)!.deposit_amount * i.quantity,
          0
        );

        return {
          kind: "booking_proposal",
          payload: {
            customerId: input.customerId,
            items: input.items.map((i) => ({
              equipmentId: i.equipmentId,
              quantity: i.quantity,
            })),
            startAt: input.startAt,
            endAt: input.endAt,
            discountAmount: 0,
            extraFeesAmount: 0,
            depositAmount: deposit,
            notes: input.notes ?? "",
            status: "confirmed",
          },
          summary: {
            customerName: formatCustomerName(customer),
            items: input.items.map((i) => ({
              equipmentName: byId.get(i.equipmentId)!.name,
              quantity: i.quantity,
              dailyPrice: byId.get(i.equipmentId)!.daily_price,
              pricingMode: byId.get(i.equipmentId)!.pricing_mode,
            })),
            startAt: input.startAt,
            endAt: input.endAt,
            durationDays,
            total: totals.total,
            deposit,
            currency,
            warnings,
          },
        };
      },
    },
  };
}
