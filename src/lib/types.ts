// Domain model — mirrors supabase/migrations/0001_init.sql

export type UserRole = "buyer" | "vendor" | "admin";

export type SellerType =
  | "hemp_farm" | "manufacturer" | "cbd_brand" | "cbg_brand" | "thca_brand"
  | "hd_cannabinoid_brand" | "beverage_brand" | "wellness_brand"
  | "accessory_retailer" | "distributor" | "wholesaler" | "retail_store"
  | "private_label" | "dropshipper" | "reseller";

export type ProductStatus =
  | "draft" | "pending_review" | "changes_requested"
  | "approved" | "live" | "suspended" | "delisted";

export type CannabinoidType =
  | "cbd" | "cbg" | "cbn" | "thca" | "delta9_hemp" | "delta8" | "hhc" | "mixed" | "none";

export type PanelResult = "pass" | "fail" | "not_tested" | "pending";

export type ComplianceStatus = "submitted" | "verified" | "rejected" | "expiring_soon" | "expired";

export type BadgeKey =
  | "identity_verified_seller" | "verified_coa" | "batch_linked_coa"
  | "recently_tested" | "marketplace_shipping_tracking" | "top_rated_seller"
  | "wholesale_capable" | "private_label_capable" | "manufacturer_direct"
  | "farm_direct" | "verified_brand";

export type OrderStatus =
  | "pending_payment" | "payment_processing" | "expired_payment" | "paid"
  | "accepted" | "label_created" | "shipped" | "delivered" | "completed"
  | "cancelled" | "refunded" | "partially_refunded";

export type DisputeStatus =
  | "open" | "awaiting_buyer_evidence" | "awaiting_seller_response"
  | "under_admin_review" | "partial_refund_proposed" | "refund_approved"
  | "refund_denied" | "return_required" | "resolved" | "closed";

export type PayoutStatus = "queued" | "approved" | "sent" | "failed" | "held";

export interface Category {
  slug: string;
  name: string;
  description: string;
  seoIntro?: string;
  ageRestricted: boolean;
  jurisdictionSensitive: boolean;
  faqs?: Faq[];
  relatedGuides?: RelatedLink[];
}

export interface Faq { q: string; a: string }
export interface RelatedLink { label: string; href: string }

export interface Vendor {
  id: string;
  slug: string;
  brandName: string;
  sellerType: SellerType;
  country: string;
  region: string;
  city?: string;
  about: string;
  brandStory?: string;
  seoDescription: string;
  logoUrl?: string;
  coverUrl?: string;
  joinedAt: string;
  identityVerified: boolean;
  businessVerified: boolean;
  walletVerified: boolean;
  wholesaleEnabled: boolean;
  privateLabelEnabled: boolean;
  handlingDaysMin: number;
  handlingDaysMax: number;
  badges: BadgeKey[];
  ratingAvg: number;
  ratingCount: number;
  onTimeShipRate: number;   // 0..1
  responseHours: number;
  productCount: number;
  policies: { shipping: string; returns: string; support: string };
  faqs?: Faq[];
}

export interface ComplianceRecord {
  id: string;
  batchNumber: string;
  labName: string;
  labWebsite?: string;
  coaIssueDate: string;
  retestDate?: string;
  delta9ThcPct?: number;
  totalThcPct?: number;
  thcaPct?: number;
  cbdPct?: number;
  cbgPct?: number;
  otherCannabinoids?: Record<string, number>;
  pesticides: PanelResult;
  heavyMetals: PanelResult;
  microbials: PanelResult;
  residualSolvents: PanelResult;
  foreignMaterial: PanelResult;
  status: ComplianceStatus;
  verifiedAt?: string;
  coaFileHash?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  compareAtCents?: number;
  stock: number;
  wholesaleOnly?: boolean;
  wholesaleTiers?: { minQuantity: number; priceCents: number }[];
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  vendorSlug: string;
  categorySlug: string;
  subtype?: string;
  description: string;
  shortDescription: string;
  status: ProductStatus;
  cannabinoidType: CannabinoidType;
  images: { url: string; alt: string }[];
  variants: ProductVariant[];
  compliance?: ComplianceRecord;
  shippingOrigin: { country: string; region: string };
  handlingDaysMin: number;
  handlingDaysMax: number;
  restrictedJurisdictions: { country: string; region?: string }[];
  ageRestricted: boolean;
  wholesaleAvailable: boolean;
  wholesaleMoq?: number;
  privateLabelAvailable: boolean;
  ratingAvg: number;
  ratingCount: number;
  badges: BadgeKey[];
  facts: Record<string, string>;   // AI-readable fact block
  faqs?: Faq[];
}

export interface Review {
  id: string;
  productSlug: string;
  vendorSlug: string;
  author: string;
  ratingOverall: number;
  ratingAccuracy?: number;
  ratingPackaging?: number;
  ratingShipping?: number;
  ratingCommunication?: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface JurisdictionDecision {
  eligible: boolean;
  effect: "allow" | "deny" | "notice_only";
  notice?: string;
}
