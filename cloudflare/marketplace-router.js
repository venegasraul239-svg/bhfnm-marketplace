/**
 * BHFNM marketplace router — Cloudflare Worker
 *
 * Route (Cloudflare dashboard → Workers Routes):
 *   buyhempflowernearme.com/marketplace*  →  this worker
 *
 * Everything else continues to hit the Hostinger WordPress origin untouched.
 * Rollback = remove the route. No DNS or WordPress changes ever required.
 *
 * Secrets (wrangler secret put):
 *   VERCEL_ORIGIN  e.g. "bhfnm-marketplace.vercel.app"
 *   PROXY_SECRET   shared secret checked by Next.js middleware to reject
 *                  direct vercel.app hits (prevents duplicate indexing).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = `https://${env.VERCEL_ORIGIN}`;

    // Next.js is built with basePath=/marketplace, so paths map 1:1.
    const upstream = new URL(url.pathname + url.search, origin);

    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-BHFNM-Proxy", env.PROXY_SECRET);

    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });

    // Rewrite any absolute vercel.app redirects back to the public host.
    const out = new Headers(response.headers);
    const loc = out.get("location");
    if (loc && loc.includes(env.VERCEL_ORIGIN)) {
      out.set("location", loc.replace(`https://${env.VERCEL_ORIGIN}`, `https://${url.hostname}`));
    }
    return new Response(response.body, { status: response.status, headers: out });
  },
};
