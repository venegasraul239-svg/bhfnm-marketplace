// Single read API for pages.
//
// TRUTHFULNESS CONTRACT (see BUILD_STATUS.md):
// - "live"  → every product, vendor, review, rating and badge comes from
//             Supabase rows that passed the review workflows (RLS-filtered).
// - "demo"  → deterministic seed catalog, ONLY when NEXT_PUBLIC_DEMO_MODE=true
//             on a non-production environment, or local dev without Supabase.
// - "empty" → production without Supabase: render truthful empty states.
// Production with Supabase configured can never serve seed data.

import { CATEGORIES, PRODUCTS, REVIEWS, VENDORS } from "./seed";
import { supabaseAnon } from "./supabase";
import type {
  BadgeKey, Category, ComplianceRecord, Product, ProductVariant, Review, SellerType, Vendor,
} from "./types";

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const isProdDeploy = process.env.VERCEL_ENV === "production";

export type DataMode = "live" | "demo" | "empty";

export function dataMode(): DataMode {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" && !isProdDeploy) return "demo";
  if (supabaseConfigured) return "live";
  return isProdDeploy ? "empty" : "demo";
}

// ---------------------------------------------------------------- categories
// Categories are editorial taxonomy (copy, FAQs, guide links) — not marketplace
// activity — so they render from the versioned seed in every mode.

export async function getCategories(): Promise<Category[]> {
  return CATEGORIES;
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return CATEGORIES.find((c) => c.slug === slug);
}

// ---------------------------------------------------------------- products

export async function getProducts(filter?: {
  category?: string;
  vendor?: string;
  wholesale?: boolean;
}): Promise<Product[]> {
  const mode = dataMode();
  if (mode === "empty") return [];
  if (mode === "demo") {
    let items = PRODUCTS.filter((p) => p.status === "live");
    if (filter?.category) items = items.filter((p) => p.categorySlug === filter.category);
    if (filter?.vendor) items = items.filter((p) => p.vendorSlug === filter.vendor);
    if (filter?.wholesale) items = items.filter((p) => p.wholesaleAvailable);
    return items;
  }

  const db = supabaseAnon()!;
  let q = db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "live")
    .order("created_at", { ascending: false });
  if (filter?.wholesale) q = q.eq("wholesale_available", true);

  const { data, error } = await q;
  if (error || !data) return [];

  let rows = data as unknown as ProductRow[];
  rows = rows.filter((r) => r.vendor && r.vendor.status === "active");
  if (filter?.category) rows = rows.filter((r) => r.category?.slug === filter.category);
  if (filter?.vendor) rows = rows.filter((r) => r.vendor?.slug === filter.vendor);

  const aggregates = await reviewAggregates(db, rows.map((r) => r.id));
  return rows.map((r) => mapProduct(r, aggregates.get(r.id)));
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const mode = dataMode();
  if (mode === "empty") return undefined;
  if (mode === "demo") return PRODUCTS.find((p) => p.slug === slug && p.status === "live");

  const db = supabaseAnon()!;
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (error || !data) return undefined;
  const row = data as unknown as ProductRow;
  if (!row.vendor || row.vendor.status !== "active") return undefined;
  const aggregates = await reviewAggregates(db, [row.id]);
  return mapProduct(row, aggregates.get(row.id));
}

// ---------------------------------------------------------------- vendors

export async function getVendors(): Promise<Vendor[]> {
  const mode = dataMode();
  if (mode === "empty") return [];
  if (mode === "demo") return VENDORS;

  const db = supabaseAnon()!;
  const { data, error } = await db
    .from("vendors")
    .select(VENDOR_SELECT)
    .eq("status", "active");
  if (error || !data) return [];
  const rows = data as unknown as VendorRow[];
  const counts = await productCounts(db, rows.map((r) => r.id));
  const ratings = await vendorReviewAggregates(db, rows.map((r) => r.id));
  return rows.map((r) => mapVendor(r, counts.get(r.id) ?? 0, ratings.get(r.id)));
}

export async function getVendor(slug: string): Promise<Vendor | undefined> {
  const mode = dataMode();
  if (mode === "empty") return undefined;
  if (mode === "demo") return VENDORS.find((v) => v.slug === slug);

  const db = supabaseAnon()!;
  const { data, error } = await db
    .from("vendors")
    .select(VENDOR_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return undefined;
  const row = data as unknown as VendorRow;
  const counts = await productCounts(db, [row.id]);
  const ratings = await vendorReviewAggregates(db, [row.id]);
  return mapVendor(row, counts.get(row.id) ?? 0, ratings.get(row.id));
}

// ---------------------------------------------------------------- reviews

export async function getReviews(filter: { product?: string; vendor?: string }): Promise<Review[]> {
  const mode = dataMode();
  if (mode === "empty") return [];
  if (mode === "demo") {
    return REVIEWS.filter(
      (r) =>
        (!filter.product || r.productSlug === filter.product) &&
        (!filter.vendor || r.vendorSlug === filter.vendor)
    );
  }

  const db = supabaseAnon()!;
  let q = db
    .from("reviews")
    .select(
      `id, rating_overall, rating_accuracy, rating_packaging, rating_shipping,
       rating_communication, title, body, verified_purchase, created_at,
       product:products!inner(slug), vendor:vendors!inner(slug),
       buyer:profiles(display_name)`
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  if (filter.product) q = q.eq("products.slug", filter.product);
  if (filter.vendor) q = q.eq("vendors.slug", filter.vendor);
  const { data, error } = await q;
  if (error || !data) return [];
  type Row = {
    id: string; rating_overall: number; rating_accuracy: number | null;
    rating_packaging: number | null; rating_shipping: number | null;
    rating_communication: number | null; title: string | null; body: string | null;
    verified_purchase: boolean; created_at: string;
    product: { slug: string } | null; vendor: { slug: string } | null;
    buyer: { display_name: string | null } | null;
  };
  return (data as unknown as Row[])
    .filter(
      (r) =>
        (!filter.product || r.product?.slug === filter.product) &&
        (!filter.vendor || r.vendor?.slug === filter.vendor)
    )
    .map((r) => ({
      id: r.id,
      productSlug: r.product?.slug ?? "",
      vendorSlug: r.vendor?.slug ?? "",
      author: r.buyer?.display_name ?? "Verified buyer",
      ratingOverall: r.rating_overall,
      ratingAccuracy: r.rating_accuracy ?? undefined,
      ratingPackaging: r.rating_packaging ?? undefined,
      ratingShipping: r.rating_shipping ?? undefined,
      ratingCommunication: r.rating_communication ?? undefined,
      title: r.title ?? "",
      body: r.body ?? "",
      verifiedPurchase: r.verified_purchase,
      createdAt: r.created_at,
    }));
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

// ================================================================ internals

const PRODUCT_SELECT = `
  id, slug, title, subtype, description, short_description, status,
  cannabinoid_type, batch_number, shipping_origin, handling_days_min,
  handling_days_max, restricted_jurisdictions, age_restricted,
  wholesale_available, wholesale_moq, private_label_available, search_facts,
  category:categories(slug),
  vendor:vendors(id, slug, brand_name, status, seller_type, wholesale_enabled, private_label_enabled),
  variants:product_variants(id, sku, name, price_cents, compare_at_cents, stock, wholesale_only),
  images:product_images(url, alt, sort),
  compliance:compliance_records(
    id, batch_number, lab_name, lab_website, coa_issue_date, retest_date,
    delta9_thc_pct, total_thc_pct, thca_pct, cbd_pct, cbg_pct, other_cannabinoids,
    pesticides, heavy_metals, microbials, residual_solvents, foreign_material,
    status, verified_at, coa_file_hash)
`;

const VENDOR_SELECT = `
  id, slug, brand_name, seller_type, country, region, about, brand_story,
  seo_description, logo_url, cover_url, joined_at, identity_verified,
  business_verified, wallet_verified, wholesale_enabled, private_label_enabled,
  handling_days_min, handling_days_max, return_policy, policies, status,
  badges:vendor_badges(badge)
`;

interface ComplianceRow {
  id: string; batch_number: string; lab_name: string; lab_website: string | null;
  coa_issue_date: string; retest_date: string | null;
  delta9_thc_pct: number | null; total_thc_pct: number | null; thca_pct: number | null;
  cbd_pct: number | null; cbg_pct: number | null;
  other_cannabinoids: Record<string, number> | null;
  pesticides: ComplianceRecord["pesticides"]; heavy_metals: ComplianceRecord["heavyMetals"];
  microbials: ComplianceRecord["microbials"]; residual_solvents: ComplianceRecord["residualSolvents"];
  foreign_material: ComplianceRecord["foreignMaterial"];
  status: ComplianceRecord["status"]; verified_at: string | null; coa_file_hash: string | null;
}

interface ProductRow {
  id: string; slug: string; title: string; subtype: string | null; description: string | null;
  short_description: string | null; status: string; cannabinoid_type: Product["cannabinoidType"];
  batch_number: string | null; shipping_origin: { country?: string; region?: string } | null;
  handling_days_min: number | null; handling_days_max: number | null;
  restricted_jurisdictions: { country: string; region?: string }[] | null;
  age_restricted: boolean; wholesale_available: boolean; wholesale_moq: number | null;
  private_label_available: boolean; search_facts: Record<string, string> | null;
  category: { slug: string } | null;
  vendor: { id: string; slug: string; brand_name: string; status: string; seller_type: SellerType;
            wholesale_enabled: boolean; private_label_enabled: boolean } | null;
  variants: { id: string; sku: string; name: string; price_cents: number;
              compare_at_cents: number | null; stock: number; wholesale_only: boolean }[];
  images: { url: string; alt: string | null; sort: number }[];
  compliance: ComplianceRow[];
}

interface VendorRow {
  id: string; slug: string; brand_name: string; seller_type: SellerType;
  country: string; region: string | null; about: string | null; brand_story: string | null;
  seo_description: string | null; logo_url: string | null; cover_url: string | null;
  joined_at: string; identity_verified: boolean; business_verified: boolean;
  wallet_verified: boolean; wholesale_enabled: boolean; private_label_enabled: boolean;
  handling_days_min: number; handling_days_max: number; return_policy: string | null;
  policies: Record<string, string> | null; status: string;
  badges: { badge: BadgeKey }[];
}

function mapCompliance(rows: ComplianceRow[]): ComplianceRecord | undefined {
  // Prefer the most recent verified record; expose verified/expiring only (RLS
  // already enforces this for anon, this is belt-and-braces).
  const usable = rows
    .filter((c) => c.status === "verified" || c.status === "expiring_soon")
    .sort((a, b) => (a.coa_issue_date < b.coa_issue_date ? 1 : -1));
  const c = usable[0];
  if (!c) return undefined;
  return {
    id: c.id,
    batchNumber: c.batch_number,
    labName: c.lab_name,
    labWebsite: c.lab_website ?? undefined,
    coaIssueDate: c.coa_issue_date,
    retestDate: c.retest_date ?? undefined,
    delta9ThcPct: c.delta9_thc_pct ?? undefined,
    totalThcPct: c.total_thc_pct ?? undefined,
    thcaPct: c.thca_pct ?? undefined,
    cbdPct: c.cbd_pct ?? undefined,
    cbgPct: c.cbg_pct ?? undefined,
    otherCannabinoids: c.other_cannabinoids ?? undefined,
    pesticides: c.pesticides,
    heavyMetals: c.heavy_metals,
    microbials: c.microbials,
    residualSolvents: c.residual_solvents,
    foreignMaterial: c.foreign_material,
    status: c.status === "expiring_soon" ? "expiring_soon" : "verified",
    verifiedAt: c.verified_at ?? undefined,
    coaFileHash: c.coa_file_hash ?? undefined,
  };
}

function productBadges(row: ProductRow, compliance?: ComplianceRecord): BadgeKey[] {
  const badges: BadgeKey[] = [];
  if (compliance) {
    badges.push("verified_coa");
    if (compliance.batchNumber && compliance.batchNumber === row.batch_number) {
      badges.push("batch_linked_coa");
    }
    const issued = new Date(compliance.coaIssueDate).getTime();
    if (Date.now() - issued < 1000 * 60 * 60 * 24 * 183) badges.push("recently_tested");
  }
  // Policy-level: every marketplace order ships with platform labels.
  badges.push("marketplace_shipping_tracking");
  if (row.wholesale_available) badges.push("wholesale_capable");
  if (row.private_label_available) badges.push("private_label_capable");
  return badges;
}

function mapProduct(row: ProductRow, agg?: { avg: number; count: number }): Product {
  const compliance = mapCompliance(row.compliance ?? []);
  const variants: ProductVariant[] = (row.variants ?? []).map((v) => ({
    id: v.id,
    sku: v.sku,
    name: v.name,
    priceCents: v.price_cents,
    compareAtCents: v.compare_at_cents ?? undefined,
    stock: v.stock,
    wholesaleOnly: v.wholesale_only,
  }));
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    vendorSlug: row.vendor?.slug ?? "",
    categorySlug: row.category?.slug ?? "",
    subtype: row.subtype ?? undefined,
    description: row.description ?? "",
    shortDescription: row.short_description ?? "",
    status: "live",
    cannabinoidType: row.cannabinoid_type,
    images: (row.images ?? [])
      .sort((a, b) => a.sort - b.sort)
      .map((i) => ({ url: i.url, alt: i.alt ?? row.title })),
    variants,
    compliance,
    shippingOrigin: {
      country: row.shipping_origin?.country ?? "US",
      region: row.shipping_origin?.region ?? "",
    },
    handlingDaysMin: row.handling_days_min ?? 1,
    handlingDaysMax: row.handling_days_max ?? 3,
    restrictedJurisdictions: row.restricted_jurisdictions ?? [],
    ageRestricted: row.age_restricted,
    wholesaleAvailable: row.wholesale_available,
    wholesaleMoq: row.wholesale_moq ?? undefined,
    privateLabelAvailable: row.private_label_available,
    ratingAvg: agg?.avg ?? 0,
    ratingCount: agg?.count ?? 0,
    badges: productBadges(row, compliance),
    facts: row.search_facts ?? {},
  };
}

function vendorBadges(row: VendorRow): BadgeKey[] {
  const fromTable = (row.badges ?? []).map((b) => b.badge);
  const derived: BadgeKey[] = [];
  if (row.identity_verified) derived.push("identity_verified_seller");
  if (row.business_verified) derived.push("verified_brand");
  if (row.wholesale_enabled) derived.push("wholesale_capable");
  if (row.private_label_enabled) derived.push("private_label_capable");
  if (row.seller_type === "manufacturer") derived.push("manufacturer_direct");
  if (row.seller_type === "hemp_farm") derived.push("farm_direct");
  return [...new Set([...fromTable, ...derived])];
}

function mapVendor(row: VendorRow, productCount: number, agg?: { avg: number; count: number }): Vendor {
  const policies = row.policies ?? {};
  return {
    id: row.id,
    slug: row.slug,
    brandName: row.brand_name,
    sellerType: row.seller_type,
    country: row.country,
    region: row.region ?? "",
    about: row.about ?? "",
    brandStory: row.brand_story ?? undefined,
    seoDescription: row.seo_description ?? "",
    logoUrl: row.logo_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    joinedAt: row.joined_at,
    identityVerified: row.identity_verified,
    businessVerified: row.business_verified,
    walletVerified: row.wallet_verified,
    wholesaleEnabled: row.wholesale_enabled,
    privateLabelEnabled: row.private_label_enabled,
    handlingDaysMin: row.handling_days_min,
    handlingDaysMax: row.handling_days_max,
    badges: vendorBadges(row),
    ratingAvg: agg?.avg ?? 0,
    ratingCount: agg?.count ?? 0,
    // Shipping/response stats come from real tracking + message data (Phase 3
    // fulfillment); until then they are absent, never fabricated.
    onTimeShipRate: 0,
    responseHours: 0,
    productCount,
    policies: {
      shipping: policies.shipping ?? "",
      returns: row.return_policy ?? policies.returns ?? "",
      support: policies.support ?? "",
    },
  };
}

type Db = NonNullable<ReturnType<typeof supabaseAnon>>;

async function reviewAggregates(db: Db, productIds: string[]) {
  const map = new Map<string, { avg: number; count: number }>();
  if (!productIds.length) return map;
  const { data } = await db
    .from("reviews")
    .select("product_id, rating_overall")
    .eq("status", "published")
    .in("product_id", productIds);
  for (const r of (data ?? []) as { product_id: string; rating_overall: number }[]) {
    const cur = map.get(r.product_id) ?? { avg: 0, count: 0 };
    cur.avg = (cur.avg * cur.count + r.rating_overall) / (cur.count + 1);
    cur.count += 1;
    map.set(r.product_id, cur);
  }
  return map;
}

async function vendorReviewAggregates(db: Db, vendorIds: string[]) {
  const map = new Map<string, { avg: number; count: number }>();
  if (!vendorIds.length) return map;
  const { data } = await db
    .from("reviews")
    .select("vendor_id, rating_overall")
    .eq("status", "published")
    .in("vendor_id", vendorIds);
  for (const r of (data ?? []) as { vendor_id: string; rating_overall: number }[]) {
    const cur = map.get(r.vendor_id) ?? { avg: 0, count: 0 };
    cur.avg = (cur.avg * cur.count + r.rating_overall) / (cur.count + 1);
    cur.count += 1;
    map.set(r.vendor_id, cur);
  }
  return map;
}

async function productCounts(db: Db, vendorIds: string[]) {
  const map = new Map<string, number>();
  if (!vendorIds.length) return map;
  const { data } = await db
    .from("products")
    .select("vendor_id")
    .eq("status", "live")
    .in("vendor_id", vendorIds);
  for (const r of (data ?? []) as { vendor_id: string }[]) {
    map.set(r.vendor_id, (map.get(r.vendor_id) ?? 0) + 1);
  }
  return map;
}
