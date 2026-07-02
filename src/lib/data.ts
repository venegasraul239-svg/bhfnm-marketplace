// Single read API for pages. Uses Supabase when configured; otherwise serves
// the deterministic seed catalog (read-only) so the app is fully reviewable
// without secrets. Mutations never touch this layer — they go through route
// handlers that require real backends.

import { CATEGORIES, PRODUCTS, REVIEWS, VENDORS } from "./seed";
import type { Category, Product, Review, Vendor } from "./types";

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// TODO(phase 1 backend wiring): swap seed reads for Supabase queries with the
// same signatures. Pages depend only on these functions.

export async function getCategories(): Promise<Category[]> {
  return CATEGORIES;
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return CATEGORIES.find((c) => c.slug === slug);
}

export async function getProducts(filter?: {
  category?: string;
  vendor?: string;
  wholesale?: boolean;
}): Promise<Product[]> {
  let items = PRODUCTS.filter((p) => p.status === "live");
  if (filter?.category) items = items.filter((p) => p.categorySlug === filter.category);
  if (filter?.vendor) items = items.filter((p) => p.vendorSlug === filter.vendor);
  if (filter?.wholesale) items = items.filter((p) => p.wholesaleAvailable);
  return items;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return PRODUCTS.find((p) => p.slug === slug && p.status === "live");
}

export async function getVendors(): Promise<Vendor[]> {
  return VENDORS;
}

export async function getVendor(slug: string): Promise<Vendor | undefined> {
  return VENDORS.find((v) => v.slug === slug);
}

export async function getReviews(filter: { product?: string; vendor?: string }): Promise<Review[]> {
  return REVIEWS.filter(
    (r) =>
      (!filter.product || r.productSlug === filter.product) &&
      (!filter.vendor || r.vendorSlug === filter.vendor)
  );
}

export async function searchProducts(q: string): Promise<Product[]> {
  const needle = q.toLowerCase();
  return (await getProducts()).filter(
    (p) =>
      p.title.toLowerCase().includes(needle) ||
      p.description.toLowerCase().includes(needle) ||
      p.cannabinoidType.includes(needle)
  );
}
