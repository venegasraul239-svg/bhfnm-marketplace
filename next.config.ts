import type { NextConfig } from "next";

/**
 * The marketplace is served under https://buyhempflowernearme.com/marketplace.
 * WordPress remains the origin for every other path. A Cloudflare Worker
 * (see cloudflare/marketplace-router.js) routes /marketplace* to this app on
 * Vercel, so basePath keeps every asset, route and canonical URL aligned with
 * the public path without any WordPress involvement.
 */
const nextConfig: NextConfig = {
  basePath: "/marketplace",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "buyhempflowernearme.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Imported catalogs reference vendor/CDN-hosted images (Shopify, Woo
      // uploads, brand sites). SafeImage degrades broken ones gracefully.
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
