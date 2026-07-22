// Import depuis la Page Facebook connectée du loueur : la fiche de la Page
// (nom, téléphone, email, adresse) est reprise telle quelle, et les
// publications récentes passent par l'analyse IA pour détecter des biens et
// des tarifs. Le jeton de Page ne quitte jamais le serveur (fonction SQL
// gardée par secret, comme pour l'envoi Messenger).

import { NextResponse, type NextRequest } from "next/server";
import {
  fetchPagePosts,
  fetchPageProfile,
  messengerConfigured,
  webhookIngestSecret,
} from "@/lib/messenger/server";
import { parseBusinessText } from "@/lib/import/parse-server";
import { checkRateLimit, clientAddress } from "@/lib/core/rate-limit";
import {
  bearerToken,
  createTokenClient,
  rawRpc,
} from "@/lib/supabase/token-client";
import type { AiParseResult } from "@/lib/validations/import";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60_000;

// Les publications assemblées restent sous la limite d'analyse (20 000).
const MAX_POSTS_CHARS = 12_000;

const AI_HINT =
  "Le texte provient de publications Facebook d'une entreprise : extrais uniquement les biens à louer et leurs tarifs ; ignore les vœux, jeux-concours et messages sans rapport avec le catalogue.";

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(
    `import-facebook:${clientAddress(request.headers)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      }
    );
  }

  if (!messengerConfigured()) {
    return NextResponse.json(
      { error: "Canal Facebook non configuré sur ce serveur." },
      { status: 501 }
    );
  }
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createTokenClient(token);
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData.user) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { error: "Aucune organisation active" },
      { status: 403 }
    );
  }

  const { data: pageRows } = await rawRpc<
    Array<{ page_id: string; page_name: string; access_token: string }>
  >(supabase, "get_messenger_page_for_org", {
    p_secret: webhookIngestSecret(),
    p_organization_id: member.organization_id,
  });
  const page = Array.isArray(pageRows) ? pageRows[0] : undefined;
  if (!page) {
    return NextResponse.json(
      {
        error:
          "Aucune Page Facebook connectée — connectez d'abord votre Page depuis Assistant → Connexions.",
      },
      { status: 400 }
    );
  }

  try {
    const profile = await fetchPageProfile(page.page_id, page.access_token);
    const posts = await fetchPagePosts(page.page_id, page.access_token);

    // Fiche de la Page : valeurs officielles, reprises sans passer par l'IA.
    const business = {
      name: profile.name?.trim() || null,
      phone: profile.phone?.trim() || null,
      email: profile.emails?.[0]?.trim() || null,
      address: profile.single_line_address?.trim() || null,
      deliveryNotes: null as string | null,
    };

    // Publications : analysées pour détecter des biens et des tarifs.
    let items: AiParseResult["items"] = [];
    let mode: "ai" | "demo" = "ai";
    const postsText = posts.join("\n\n———\n\n").slice(0, MAX_POSTS_CHARS);
    if (postsText.trim().length > 40) {
      const parsed = await parseBusinessText(postsText, AI_HINT);
      items = parsed.result.items;
      mode = parsed.mode;
      business.deliveryNotes = parsed.result.business.deliveryNotes;
    }

    return NextResponse.json({
      mode,
      result: { items, business },
      pageName: profile.name ?? page.page_name,
      website: profile.website?.trim() || null,
      postsAnalyzed: posts.length,
    });
  } catch (error) {
    console.error(
      "[import/facebook-page] échec :",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        error:
          "Lecture de la Page impossible — reconnectez votre Page depuis Assistant → Connexions puis réessayez.",
      },
      { status: 502 }
    );
  }
}
