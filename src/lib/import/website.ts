// Lecture du site web public d'un loueur — CÔTÉ SERVEUR UNIQUEMENT.
// Récupère la page d'accueil puis quelques sous-pages pertinentes (tarifs,
// catalogue…), convertit le HTML en texte lisible et assemble le tout pour
// l'analyse IA. Garde-fous anti-abus : uniquement des hôtes publics (jamais
// d'adresse privée ou locale), redirections revalidées à chaque saut, délai,
// taille et nombre de pages bornés. Le contenu brut n'est jamais renvoyé au
// navigateur — seul le résultat d'analyse validé l'est.

import { lookup } from "node:dns/promises";

const MAX_REDIRECTS = 3;
const MAX_SUBPAGES = 3;
const MAX_HTML_BYTES = 1_500_000; // 1,5 Mo par page
const MAX_TEXT_TOTAL = 18_000; // sous la limite des 20 000 de l'analyse
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; PacificCodeImport/1.0; +https://pacific-code.duckdns.org)";

/** Erreur destinée à l'utilisateur (message français, HTTP 422). */
export class WebsiteImportError extends Error {}

// ------------------------------------------------------------
// Garde-fous réseau
// ------------------------------------------------------------

/** Adresses IP privées, locales ou réservées — jamais contactées. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b, c] = [Number(v4[1]), Number(v4[2]), Number(v4[3])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true; // multicast, réservé, broadcast
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // ULA fc00::/7
  if (/^fe[89ab]/.test(v6)) return true; // lien-local fe80::/10
  if (v6.startsWith("2001:db8")) return true; // plage de documentation
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return false;
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan")
  ) {
    throw new WebsiteImportError("Cette adresse n'est pas autorisée.");
  }
  // IP littérale (v4 ou v6) : vérifiée directement.
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isPrivateAddress(host)) {
      throw new WebsiteImportError("Cette adresse n'est pas autorisée.");
    }
    return;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new WebsiteImportError(
      "Ce site est introuvable — vérifiez l'adresse."
    );
  }
  // La résolution peut différer légèrement de celle du fetch (TOCTOU) :
  // risque résiduel accepté, le contenu lu n'étant jamais renvoyé brut.
  if (
    addresses.length === 0 ||
    addresses.some((a) => isPrivateAddress(a.address))
  ) {
    throw new WebsiteImportError("Cette adresse n'est pas autorisée.");
  }
}

async function readCapped(
  response: Response,
  maxBytes: number
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Récupère une page HTML publique (redirections revalidées, taille bornée). */
export async function safeFetchHtml(
  rawUrl: string
): Promise<{ url: string; html: string }> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new WebsiteImportError("Adresse invalide.");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!/^https?:$/.test(current.protocol)) {
      throw new WebsiteImportError("Seules les adresses http(s) sont autorisées.");
    }
    await assertPublicHost(current);

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "fr,fr-FR;q=0.9,en;q=0.5",
        },
      });
    } catch {
      throw new WebsiteImportError(
        "Le site ne répond pas — vérifiez l'adresse ou réessayez plus tard."
      );
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) {
        throw new WebsiteImportError("Le site renvoie une redirection invalide.");
      }
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      throw new WebsiteImportError(
        `Le site a répondu avec une erreur (${response.status}).`
      );
    }
    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(type)) {
      throw new WebsiteImportError(
        "Cette adresse n'est pas une page web lisible (essayez la page d'accueil du site)."
      );
    }
    const html = await readCapped(response, MAX_HTML_BYTES);
    return { url: current.toString(), html };
  }
  throw new WebsiteImportError("Le site enchaîne trop de redirections.");
}

// ------------------------------------------------------------
// HTML → texte lisible
// ------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  agrave: "à", acirc: "â", auml: "ä", ccedil: "ç",
  ocirc: "ô", ouml: "ö", ograve: "ò",
  ucirc: "û", ugrave: "ù", uuml: "ü",
  icirc: "î", iuml: "ï",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  hellip: "…", ndash: "–", mdash: "—", middot: "·",
  deg: "°", euro: "€", copy: "©", reg: "®", trade: "™",
  laquo: "«", raquo: "»",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      safeCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(
      /&([a-z]+);/gi,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match
    );
}

function safeCodePoint(code: number): string {
  return Number.isFinite(code) && code > 8 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : " ";
}

/** Convertit une page HTML en texte lisible (titre et description inclus). */
export function htmlToText(html: string): string {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|svg|iframe|template)\b[\s\S]*?<\/\1\s*>/gi,
      " "
    )
    .replace(/<head\b[\s\S]*?<\/head\s*>/gi, (head) => {
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? "";
      const description =
        /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(
          head
        )?.[1] ?? "";
      return `${title}\n${description}\n`;
    });

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<(td|th)\b[^>]*>/gi, " | ")
    .replace(
      /<\/(p|div|section|article|aside|h[1-6]|tr|table|ul|ol|li|dl|dt|dd|header|footer|main|nav|blockquote|figure|figcaption)\s*>/gi,
      "\n"
    )
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(text)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ------------------------------------------------------------
// Découverte des sous-pages utiles (tarifs, catalogue…)
// ------------------------------------------------------------

const LINK_KEYWORDS = [
  "tarif", "prix", "price", "location", "louer", "rent",
  "catalogue", "catalog", "materiel", "flotte", "fleet",
  "vehicule", "voiture", "scooter", "bateau", "velo",
  "service", "prestation", "offre", "produit", "boutique",
  "reservation", "booking", "contact", "apropos", "a-propos", "about",
];

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Liens internes les plus prometteurs d'une page (3 maximum). */
export function discoverCatalogLinks(html: string, base: URL): string[] {
  const scores = new Map<string, number>();
  const anchorPattern =
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a\s*>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = (match[1] ?? match[2] ?? "").trim();
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }
    if (resolved.origin !== base.origin) continue;
    if (
      /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|rar|docx?|xlsx?|pptx?|mp[34])$/i.test(
        resolved.pathname
      )
    ) {
      continue;
    }
    resolved.hash = "";
    if (resolved.pathname === base.pathname && resolved.search === base.search) {
      continue;
    }

    const label = normalizeForMatch(
      `${resolved.pathname} ${match[3].replace(/<[^>]+>/g, " ")}`
    );
    let score = 0;
    for (const keyword of LINK_KEYWORDS) {
      if (label.includes(keyword)) score += 1;
    }
    if (score === 0) continue;

    const key = resolved.toString();
    scores.set(key, Math.max(scores.get(key) ?? 0, score));
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SUBPAGES)
    .map(([url]) => url);
}

// ------------------------------------------------------------
// Assemblage du texte du site
// ------------------------------------------------------------

export type SiteExtract = {
  pages: Array<{ url: string; chars: number }>;
  text: string;
};

/** Lit la page principale + sous-pages utiles, renvoie le texte assemblé. */
export async function collectSiteText(rawUrl: string): Promise<SiteExtract> {
  const main = await safeFetchHtml(rawUrl);
  const sections = [{ url: main.url, text: htmlToText(main.html) }];

  for (const link of discoverCatalogLinks(main.html, new URL(main.url))) {
    try {
      const sub = await safeFetchHtml(link);
      const text = htmlToText(sub.html);
      if (text.length > 80) sections.push({ url: sub.url, text });
    } catch {
      // Sous-page illisible ou refusée : la page principale suffit.
    }
  }

  let remaining = MAX_TEXT_TOTAL;
  const parts: string[] = [];
  const pages: SiteExtract["pages"] = [];
  for (const section of sections) {
    if (remaining <= 200) break;
    const slice = section.text.slice(0, remaining);
    parts.push(`PAGE : ${section.url}\n${slice}`);
    pages.push({ url: section.url, chars: slice.length });
    remaining -= slice.length;
  }

  const text = parts.join("\n\n———\n\n");
  if (text.replace(/\s+/g, "").length < 120) {
    throw new WebsiteImportError(
      "Le site ne contient pas assez de texte lisible (site en images ou protégé) — essayez la méthode « brochure ou photo »."
    );
  }
  return { pages, text };
}
