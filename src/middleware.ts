// Blocks direct access to the vercel.app deployment when the Cloudflare Worker
// proxy secret is configured — prevents duplicate indexing of the non-canonical
// host and keeps the public entry point single.

import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const expected = process.env.PROXY_SECRET;
  if (!expected) return NextResponse.next(); // local/preview: open

  const provided = req.headers.get("x-bhfnm-proxy");
  if (provided === expected) return NextResponse.next();

  // Allow health checks; redirect everything else to the canonical host.
  if (req.nextUrl.pathname === "/marketplace/api/health") return NextResponse.next();
  return NextResponse.redirect(`https://buyhempflowernearme.com${req.nextUrl.pathname}${req.nextUrl.search}`, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
