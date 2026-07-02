import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/marketplace",
        disallow: [
          "/marketplace/vendor-dashboard",
          "/marketplace/admin",
          "/marketplace/account",
          "/marketplace/orders",
          "/marketplace/messages",
          "/marketplace/disputes",
          "/marketplace/api",
          "/marketplace/search",
        ],
      },
    ],
    sitemap: "https://buyhempflowernearme.com/marketplace/sitemap.xml",
  };
}
