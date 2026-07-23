import { describe, expect, it } from "vitest";
import {
  computeOnboardingProgress,
  isBusinessUnconfigured,
} from "@/lib/core/onboarding";
import type {
  Customer,
  EquipmentItem,
  Organization,
} from "@/lib/types/database";

function org(patch: Partial<Organization> = {}): Organization {
  return {
    id: "org1",
    name: "Test",
    business_type: "equipment",
    logo_url: null,
    currency: "XPF",
    timezone: "Pacific/Tahiti",
    locale: "fr",
    date_format: "dd/MM/yyyy",
    booking_prefix: "TST",
    phone: null,
    email: null,
    address: null,
    slug: "test",
    storefront_welcome: null,
    storefront_visible: true,
    onboarding_completed_at: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

function item(patch: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: Math.random().toString(36).slice(2),
    organization_id: "org1",
    category_id: null,
    name: "Bien",
    internal_ref: null,
    description: null,
    daily_price: 1000,
    pricing_mode: "daily",
    deposit_amount: 0,
    quantity_total: 1,
    min_rental_days: 1,
    status: "available",
    usage_instructions: null,
    internal_notes: null,
    photo_url: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    ...patch,
  };
}

const customer = { archived_at: null } as Customer;

describe("isBusinessUnconfigured", () => {
  it("vrai uniquement pour un espace vide sans onboarding terminé", () => {
    expect(isBusinessUnconfigured(org(), [], [], 0)).toBe(true);
    expect(isBusinessUnconfigured(org(), [item()], [], 0)).toBe(false);
    expect(isBusinessUnconfigured(org(), [], [customer], 0)).toBe(false);
    expect(isBusinessUnconfigured(org(), [], [], 3)).toBe(false);
    expect(
      isBusinessUnconfigured(
        org({ onboarding_completed_at: "2026-07-18T00:00:00Z" }),
        [],
        [],
        0
      )
    ).toBe(false);
  });
});

describe("computeOnboardingProgress", () => {
  it("0/5 pour un espace neuf", () => {
    const progress = computeOnboardingProgress(org(), [], []);
    expect(progress.doneCount).toBe(0);
    expect(progress.completed).toBe(false);
  });

  it("compte chaque étape indépendamment", () => {
    const progress = computeOnboardingProgress(
      org({ phone: "+689 87 00 00 00" }),
      [item({ daily_price: 5000 })],
      [customer]
    );
    const byId = Object.fromEntries(progress.steps.map((s) => [s.id, s.done]));
    expect(byId.business).toBe(true);
    expect(byId.catalog).toBe(true);
    expect(byId.pricing).toBe(true);
    expect(byId.public_link).toBe(false); // onboarding non terminé
    expect(byId.customer_form).toBe(true);
    expect(progress.doneCount).toBe(4);
  });

  it("tarifs non vérifiés si un bien actif est à 0", () => {
    const progress = computeOnboardingProgress(org(), [
      item({ daily_price: 5000 }),
      item({ daily_price: 0 }),
    ], []);
    const pricing = progress.steps.find((s) => s.id === "pricing");
    expect(pricing?.done).toBe(false);
  });

  it("ignore les biens archivés", () => {
    const progress = computeOnboardingProgress(org(), [
      item({ daily_price: 0, archived_at: "2026-01-02T00:00:00Z" }),
      item({ daily_price: 4000 }),
    ], []);
    const pricing = progress.steps.find((s) => s.id === "pricing");
    expect(pricing?.done).toBe(true);
  });

  it("5/5 après import complet", () => {
    const progress = computeOnboardingProgress(
      org({
        phone: "+689 87 00 00 00",
        onboarding_completed_at: "2026-07-18T00:00:00Z",
      }),
      [item()],
      [customer]
    );
    expect(progress.completed).toBe(true);
    expect(progress.ratio).toBe(1);
  });
});
