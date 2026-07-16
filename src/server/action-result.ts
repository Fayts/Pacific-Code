import { z } from "zod";

// Résultat uniforme des server actions : jamais d'exception côté client,
// toujours un objet sérialisable { ok, data | error }.

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError<T = undefined>(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

export function zodError<T = undefined>(
  error: z.ZodError
): ActionResult<T> {
  const flat = error.flatten();
  return {
    ok: false,
    error: "Certains champs sont invalides",
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
  };
}

/** Message utilisateur lisible à partir d'une erreur inconnue. */
export function toUserMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
