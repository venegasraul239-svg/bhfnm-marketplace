import type { MetadataRoute } from "next";
import { getCategories, getProducts, getVendors } from "@/lib/data";

const BASE = "https://buyhempflowernearme.com/marketplace";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, vendors] = await Promise.all([
    getCategories(),
    getProducts(),
    getVendors(),
  ]);

  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/categories`, changeFrequency: "weekly", priority: 0.8 },
    ...categories.map((c) => ({
      url: `${BASE}/categories/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    ...products.map((p) => ({
      url: `${BASE}/product/${p.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...vendors.map((v) => ({
      url: `${BASE}/store/${v.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${BASE}/vendors/apply`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
