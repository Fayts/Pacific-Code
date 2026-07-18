// Modèle de fichier d'import téléchargeable (CSV, séparateur ";").

const HEADERS = [
  "Nom",
  "Catégorie",
  "Référence interne",
  "Description",
  "Quantité",
  "Prix journalier (XPF)",
  "Caution (XPF)",
  "Durée minimale (jours)",
  "Remarques",
];

const EXAMPLE_ROW = [
  "Kärcher Puzzi 10/1",
  "Matériel",
  "PUZ-01",
  "Injecteur-extracteur pour moquettes et sièges",
  "1",
  "7990",
  "20000",
  "1",
  "Livré avec 2 bidons de shampoing",
];

const NOTE_ROW = [
  "— Ligne d'exemple à remplacer. Seuls Nom et Catégorie sont indispensables ; les prix sans valeur seront marqués « à compléter ». —",
];

function toCsvLine(cells: string[]): string {
  return cells
    .map((cell) =>
      /[";\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
    )
    .join(";");
}

export function buildTemplateCsv(): string {
  return [
    toCsvLine(HEADERS),
    toCsvLine(EXAMPLE_ROW),
    toCsvLine(NOTE_ROW),
  ].join("\r\n");
}

/** Déclenche le téléchargement du modèle côté navigateur. */
export function downloadTemplate() {
  const blob = new Blob(["﻿" + buildTemplateCsv()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modele-import-pacific-code.csv";
  link.click();
  URL.revokeObjectURL(url);
}
