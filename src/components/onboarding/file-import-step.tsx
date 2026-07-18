"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  autoMapColumns,
  parseCsv,
  rowsToItems,
  FIELD_LABELS,
  MAX_CSV_SIZE,
  MAX_CSV_ROWS,
  type CsvTable,
  type ImportField,
} from "@/lib/import/csv";
import { downloadTemplate } from "@/lib/import/template";
import type { ParsedItem } from "@/lib/types/import";
import { cn } from "@/lib/utils";

const FIELD_ITEMS = (
  Object.entries(FIELD_LABELS) as Array<[ImportField, string]>
).map(([value, label]) => ({ value, label }));

// Import CSV : dépôt du fichier puis association des colonnes aux champs.
export function FileImportStep({
  onParsed,
}: {
  onParsed: (fileName: string, items: ParsedItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const readFile = async (file: File) => {
    if (file.size > MAX_CSV_SIZE) {
      toast.error("Fichier trop volumineux (1 Mo maximum).");
      return;
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error(
        "Format non pris en charge : utilisez un fichier CSV (dans Excel : Enregistrer sous → CSV)."
      );
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("Le fichier semble vide ou illisible.");
      return;
    }
    if (parsed.rows.length > MAX_CSV_ROWS) {
      toast.warning(
        `Fichier tronqué aux ${MAX_CSV_ROWS} premières lignes pour cet import.`
      );
    }
    setFileName(file.name);
    setTable(parsed);
    setMapping(autoMapColumns(parsed.headers));
  };

  const confirm = () => {
    if (!table) return;
    if (!mapping.includes("name")) {
      toast.error("Associez au moins une colonne au champ « Nom du bien ».");
      return;
    }
    const items = rowsToItems(table, mapping).filter((i) => i.name.trim());
    if (items.length === 0) {
      toast.error("Aucune ligne exploitable : vérifiez la colonne du nom.");
      return;
    }
    onParsed(fileName ?? "import.csv", items);
  };

  if (!table) {
    return (
      <div className="mx-auto max-w-2xl">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) void readFile(file);
          }}
          className={cn(
            "flex flex-col items-center rounded-2xl border-2 border-dashed bg-card px-6 py-14 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/[0.04]"
              : "border-pc-lagoon/25"
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-pc-lagoon/12 to-pc-turquoise/18">
            <FileSpreadsheet className="size-6 text-primary" aria-hidden />
          </span>
          <h2 className="mt-4 font-semibold text-foreground">
            Déposez votre fichier CSV ici
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Colonnes libres : vous les associerez aux bons champs à l’étape
            suivante. Seul le nom est indispensable.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-10 bg-gradient-to-r from-pc-lagoon to-pc-turquoise font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
            >
              <Upload className="size-4" aria-hidden />
              Choisir un fichier
            </Button>
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download className="size-4" aria-hidden />
              Télécharger le modèle d’import
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    );
  }

  const previewRows = table.rows.slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl bg-card p-6 shadow-sm shadow-pc-deep/[0.04] ring-1 ring-pc-deep/[0.08]">
        <h2 className="font-semibold text-foreground">
          Associez les colonnes de « {fileName} »
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {table.rows.length} ligne{table.rows.length > 1 ? "s" : ""} détectée
          {table.rows.length > 1 ? "s" : ""} — les colonnes reconnues sont déjà
          associées, ajustez si besoin.
        </p>

        <div className="mt-5 space-y-3">
          {table.headers.map((header, i) => (
            <div
              key={`${header}-${i}`}
              className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 sm:w-1/2">
                <p className="truncate text-sm font-medium text-foreground">
                  {header || `Colonne ${i + 1}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  ex. :{" "}
                  {previewRows
                    .map((r) => r[i])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(" · ") || "—"}
                </p>
              </div>
              <Select
                items={FIELD_ITEMS}
                value={mapping[i]}
                onValueChange={(v) => {
                  const next = [...mapping];
                  const field = v as ImportField;
                  if (field !== "ignore") {
                    // Un champ ne peut être associé qu’à une seule colonne.
                    const already = next.indexOf(field);
                    if (already !== -1 && already !== i) next[already] = "ignore";
                  }
                  next[i] = field;
                  setMapping(next);
                }}
              >
                <SelectTrigger className="w-full sm:w-64" aria-label={`Champ pour ${header}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={confirm}
            className="h-10 bg-gradient-to-r from-pc-lagoon to-pc-turquoise font-semibold text-white shadow-lg shadow-pc-lagoon/25 hover:brightness-105"
          >
            Continuer vers la vérification
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTable(null);
              setFileName(null);
            }}
          >
            Choisir un autre fichier
          </Button>
        </div>
      </div>
    </div>
  );
}
