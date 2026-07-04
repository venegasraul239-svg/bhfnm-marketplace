// 1. Canonical-host enforcement: block direct vercel.app access when the
//    Cloudflare Worker proxy secret is configured.
// 2. Supabase session refresh (cookie rotation) on every request.
// 3. Coarse auth gate for protected sections — role checks happen server-side
//    in layouts/handlers (lib/auth.ts); middleware only requires a session.

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths are matched WITHOUT the /marketplace basePath inside middleware.
const AUTH_REQUIRED_PREFIXES = [
  "/admin",
  "/vendor-dashboard",
  "/account",
  "/orders",
  "/messages",
  "/disputes",
];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/marketplace(?=\/|$)/, "") || "/";

  // --- canonical host guard -------------------------------------------------
  const expected = process.env.PROXY_SECRET;
  if (expected) {
    const provided = req.headers.get("x-bhfnm-proxy");
    if (provided !== expected && pathname !== "/api/health") {
      return NextResponse.redirect(
        `https://buyhempflowernearme.com/marketplace${pathname === "/" ? "" : pathname}${req.nextUrl.search}`,
        308
      );
    }
  }

  // --- session refresh --------------------------------------------------------
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let hasSession = false;
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    hasSession = Boolean(data.user);
  }

  // --- coarse auth gate -------------------------------------------------------
  const needsAuth = AUTH_REQUIRED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (needsAuth && !hasSession) {
    // Plain URL to sidestep NextURL basePath re-prefixing ambiguity.
    return NextResponse.redirect(
      new URL(`/marketplace/auth/sign-in?next=${encodeURIComponent(pathname)}`, req.url)
    );
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)).*)"],
};
