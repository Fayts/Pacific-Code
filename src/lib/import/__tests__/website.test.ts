// Tests unitaires du module site web : conversion HTML → texte, découverte
// des sous-pages utiles et blocage des adresses privées. Aucun accès réseau.

import { describe, expect, it } from "vitest";
import {
  discoverCatalogLinks,
  htmlToText,
  isPrivateAddress,
} from "@/lib/import/website";

describe("htmlToText", () => {
  it("garde le titre et la description, retire scripts et styles", () => {
    const html = `<!doctype html><html><head>
      <title>Tahiti Loc — location de scooters</title>
      <meta name="description" content="Scooters dès 3 500 XPF/jour">
      <style>body { color: red }</style>
      <script>alert("piège")</script>
    </head><body>
      <h1>Nos scooters</h1>
      <p>Scooter 125 cm³ à 3&nbsp;500&#160;XPF par jour.</p>
      <script>document.write("invisible")</script>
    </body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Tahiti Loc — location de scooters");
    expect(text).toContain("Scooters dès 3 500 XPF/jour");
    expect(text).toContain("Nos scooters");
    expect(text).toContain("Scooter 125 cm³ à 3 500 XPF par jour.");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color: red");
    expect(text).not.toContain("invisible");
  });

  it("décode les entités françaises et sépare les blocs", () => {
    const html =
      "<div>V&eacute;hicule &agrave; louer</div><ul><li>Caution&nbsp;: 20&#8239;000 XPF</li><li>Livraison &ccedil;a d&eacute;pend</li></ul>";
    const text = htmlToText(html);
    expect(text).toContain("Véhicule à louer");
    expect(text).toContain("- Caution");
    expect(text).toContain("Livraison ça dépend");
    expect(text.split("\n").length).toBeGreaterThan(1);
  });

  it("transforme les cellules de tableau en colonnes lisibles", () => {
    const html =
      "<table><tr><th>Bien</th><th>Prix</th></tr><tr><td>Kärcher</td><td>7 990 XPF</td></tr></table>";
    const text = htmlToText(html);
    expect(text).toContain("| Bien | Prix");
    expect(text).toContain("| Kärcher | 7 990 XPF");
  });
});

describe("discoverCatalogLinks", () => {
  const base = new URL("https://tahitiloc.pf/");

  it("retient les liens internes pertinents, classés par intérêt", () => {
    const html = `
      <a href="/tarifs">Nos tarifs de location</a>
      <a href="/blog/vacances">Le blog</a>
      <a href="https://facebook.com/tahitiloc">Facebook</a>
      <a href="/catalogue">Catalogue</a>
      <a href="mailto:contact@tahitiloc.pf">Écrire</a>
      <a href="/mentions">Mentions</a>
    `;
    const links = discoverCatalogLinks(html, base);
    expect(links).toContain("https://tahitiloc.pf/tarifs");
    expect(links).toContain("https://tahitiloc.pf/catalogue");
    expect(links).not.toContain("https://facebook.com/tahitiloc");
    expect(links.some((l) => l.startsWith("mailto:"))).toBe(false);
    expect(links).not.toContain("https://tahitiloc.pf/mentions");
  });

  it("limite à 3, dédoublonne et ignore la page courante et les fichiers", () => {
    const html = `
      <a href="/">Accueil (location)</a>
      <a href="/tarifs">Tarifs</a>
      <a href="/tarifs#bas">Tarifs (ancre)</a>
      <a href="/location-voiture">Location voiture</a>
      <a href="/location-bateau">Location bateau</a>
      <a href="/location-scooter">Location scooter</a>
      <a href="/brochure.pdf">Brochure tarifs PDF</a>
    `;
    const links = discoverCatalogLinks(html, base);
    expect(links.length).toBe(3);
    expect(new Set(links).size).toBe(3);
    expect(links).not.toContain("https://tahitiloc.pf/");
    expect(links.some((l) => l.endsWith(".pdf"))).toBe(false);
    expect(links.filter((l) => l === "https://tahitiloc.pf/tarifs").length
    ).toBeLessThanOrEqual(1);
  });
});

describe("isPrivateAddress", () => {
  it("bloque les plages privées, locales et réservées", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.8",
      "172.16.4.2",
      "172.31.255.1",
      "192.168.1.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "::",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:192.168.0.5",
      "2001:db8::1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("laisse passer les adresses publiques", () => {
    for (const ip of [
      "8.8.8.8",
      "76.76.21.21",
      "172.15.0.1",
      "172.32.0.1",
      "100.63.0.1",
      "198.51.99.1",
      "2606:4700::6810:84e5",
      "::ffff:8.8.4.4",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
