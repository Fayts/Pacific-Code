import { describe, expect, it } from "vitest";

import { deriveBookingPrefix } from "@/lib/core/org";

describe("deriveBookingPrefix", () => {
  it("prend les initiales des mots : « Pacific Rent&Clean » → PRC", () => {
    expect(deriveBookingPrefix("Pacific Rent&Clean")).toBe("PRC");
  });

  it("complète un nom d'un seul mot avec ses premières lettres", () => {
    expect(deriveBookingPrefix("Tahiti")).toBe("TAH");
    expect(deriveBookingPrefix("Go")).toBe("GO");
  });

  it("ignore les accents", () => {
    expect(deriveBookingPrefix("Électricité Générale")).toBe("EG");
    expect(deriveBookingPrefix("Îles Sous-le-Vent")).toBe("ISLV");
  });

  it("replie sur RES pour une chaîne vide ou sans caractère exploitable", () => {
    expect(deriveBookingPrefix("")).toBe("RES");
    expect(deriveBookingPrefix("   ")).toBe("RES");
    expect(deriveBookingPrefix("&&&")).toBe("RES");
  });

  it("limite le préfixe à 6 caractères", () => {
    expect(
      deriveBookingPrefix("Alpha Bravo Charlie Delta Echo Foxtrot Golf")
    ).toBe("ABCDEF");
  });

  it("accepte les chiffres dans les initiales", () => {
    expect(deriveBookingPrefix("2 Roues Pacifique")).toBe("2RP");
  });
});
