// Badge definitions + labels. Badges are derived from verified facts only —
// grant logic runs server-side; UI merely renders what the data layer grants.

import type { BadgeKey } from "./types";

export const BADGE_META: Record<BadgeKey, { label: string; description: string }> = {
  identity_verified_seller: {
    label: "Identity Verified Seller",
    description: "Owner identity confirmed with government-issued ID during onboarding review.",
  },
  verified_coa: {
    label: "Verified COA",
    description: "The certificate of analysis for this batch was reviewed and verified by marketplace compliance.",
  },
  batch_linked_coa: {
    label: "Batch Linked COA",
    description: "The COA on this listing is tied to the exact batch/lot number being sold.",
  },
  recently_tested: {
    label: "Recently Tested",
    description: "COA issued within the last 6 months.",
  },
  marketplace_shipping_tracking: {
    label: "Marketplace Shipping Tracking",
    description: "Ships with platform-generated labels and carrier-validated tracking events.",
  },
  top_rated_seller: {
    label: "Top Rated Seller",
    description: "Sustained 4.8+ rating with high review volume and on-time shipping.",
  },
  wholesale_capable: {
    label: "Wholesale Capable",
    description: "Approved for bulk sales with MOQ and tiered pricing.",
  },
  private_label_capable: {
    label: "Private Label Capable",
    description: "Approved to offer private-label manufacturing.",
  },
  manufacturer_direct: {
    label: "Manufacturer Direct",
    description: "Verified as the manufacturer of the products sold.",
  },
  farm_direct: {
    label: "Farm Direct",
    description: "Verified as the licensed farm growing the products sold.",
  },
  verified_brand: {
    label: "Verified Brand",
    description: "Business registration and brand ownership verified by document review.",
  },
};
