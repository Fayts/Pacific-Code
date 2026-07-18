"use client";

import { RotateCcw, Waves } from "lucide-react";

// Écran d'erreur global, dans l'univers visuel du produit.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pc-lagoon to-pc-turquoise text-white shadow-lg shadow-pc-turquoise/25">
        <Waves className="size-6" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
        Un grain de sable s&apos;est glissé.
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Une erreur inattendue est survenue. Vos données sont intactes —
        réessayez, tout devrait rentrer dans l&apos;ordre.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-pc-lagoon/25 transition hover:brightness-105"
      >
        <RotateCcw className="size-4" aria-hidden />
        Réessayer
      </button>
    </div>
  );
}
