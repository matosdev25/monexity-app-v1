import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Waitlist mode ─────────────────────────────────────────────────────────────
const WAITLIST_MODE = process.env.WAITLIST_MODE === "true";

const PUBLIC_ROUTES = [
  "/legal",
  "/auth/login",
  "/auth/sign-up",
  "/auth/check-email",
  "/auth/confirm",
  "/auth/forgot-password",
  "/auth/update-password",
  "/auth/error",
];

// Next.js 16: convención Proxy (antes middleware.ts). Corre en Node.js; no admite `runtime`.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-search", request.nextUrl.search);

  // ── Waitlist mode ────────────────────────────────────────────────────────────
  if (WAITLIST_MODE) {
    const allowed =
      pathname === "/" ||
      pathname.startsWith("/legal") ||
      pathname.startsWith("/api/waitlist") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/logo") ||
      pathname.startsWith("/favicon");
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      url.hash = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Auth normal ──────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) return response;

    const isPublicRoute =
      pathname === "/" || PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

    if (!user) {
      if (isPublicRoute) return response;
      if (pathname.startsWith("/onboarding") && request.cookies.has("pending_signup")) {
        return response;
      }
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      return NextResponse.redirect(url);
    }

    // Las páginas legales son públicas también para usuarios autenticados: deben poder
    // leerse aunque tengan pendiente la aceptación (el guard vive solo en /dashboard).
    const isLegalRoute = pathname === "/legal" || pathname.startsWith("/legal/");

    if (isPublicRoute && !isLegalRoute && !pathname.startsWith("/auth/update-password")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return response;
  } catch {
    return NextResponse.next({ request });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
