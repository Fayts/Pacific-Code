// Limiteur de débit en mémoire (fenêtre fixe par clé). Suffisant pour un
// déploiement mono-conteneur ; à remplacer par un stockage partagé (Redis,
// Upstash) si l'app est un jour répliquée.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  /** Secondes avant la prochaine fenêtre (pour l'en-tête Retry-After). */
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Purge paresseuse : évite que la Map grossisse indéfiniment.
  if (windows.size > 10_000) {
    for (const [k, w] of windows) {
      if (w.resetAt <= now) windows.delete(k);
    }
  }

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Adresse du client derrière le reverse proxy (Caddy renseigne X-Forwarded-For). */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
