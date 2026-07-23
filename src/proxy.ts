import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Garde serveur des pages (mode Supabase uniquement).
//
// En mode MOCK, les données et la session vivent dans le navigateur : la
// protection reste assurée côté client et ce proxy laisse tout passer.
//
// En mode SUPABASE, la session vit dans des cookies (@supabase/ssr côté
// navigateur) : le proxy la rafraîchit et refuse l'accès aux pages de
// l'application sans session valide — la protection ne repose plus sur le
// JavaScript client. Les routes /api gardent leur propre authentification
// (jeton Bearer, secrets d'ingestion) et ne passent pas par ce matcher.

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inbox",
  "/bookings",
  "/calendar",
  "/equipment",
  "/customers",
  "/assistant",
  "/settings",
  "/onboarding",
  "/print",
];

const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DATA_MODE !== "supabase") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() valide le jeton auprès de Supabase (pas seulement le cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inbox/:path*",
    "/bookings/:path*",
    "/calendar/:path*",
    "/equipment/:path*",
    "/customers/:path*",
    "/assistant/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/print/:path*",
    "/login",
    "/signup",
  ],
};
