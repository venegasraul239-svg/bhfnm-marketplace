// Search ranking composition — mirrored into Meilisearch custom ranking rules
// in production. Priority order per spec:
// compliance quality > listing health > verification > relevance > reviews >
// shipping > inventory > buyer location > organic quality > sponsored (trust-gated).

import type { Product, Vendor } from "./types";
import { bayesianReview } from "./health-score";

export interface RankableItem {
  product: Product;
  vendor: Vendor;
  healthScore: number;        // internal listing health 0..100
  sponsored?: boolean;
  destinationEligible?: boolean;
}

const COMPLIANCE_SENSITIVE = new Set(["hemp-flower", "cbd-flower", "cbg-flower", "thca-flower", "vapes", "concentrates", "thc-drinks"]);

export function complianceTier(p: Product): number {
  const c = p.compliance;
  if (!c) return 0;
  if (c.status === "expired" || c.status === "rejected") return 0;
  if (c.status === "verified") {
    const full = [c.pesticides, c.heavyMetals, c.microbials].every((r) => r === "pass");
    return full ? 3 : 2;
  }
  return 1; // submitted / expiring_soon
}

export function verificationTier(v: Vendor): number {
  return (v.identityVerified ? 1 : 0) + (v.businessVerified ? 1 : 0) + (v.walletVerified ? 1 : 0);
}

export function rank(items: RankableItem[], opts?: { categorySlug?: string }): RankableItem[] {
  const sensitive = opts?.categorySlug ? COMPLIANCE_SENSITIVE.has(opts.categorySlug) : true;

  const scored = items.map((it) => {
    const compliance = complianceTier(it.product);
    const score =
      compliance * 1_000_000 +
      it.healthScore * 1_000 +
      verificationTier(it.vendor) * 200 +
      bayesianReview(it.product.ratingAvg, it.product.ratingCount) * 20 +
      it.vendor.onTimeShipRate * 40 +
      (it.destinationEligible ? 30 : 0);
    return { it, score, compliance };
  });

  scored.sort((a, b) => b.score - a.score);

  // Sponsored items may move up only among equal-or-lower organic quality and
  // never above higher-compliance listings in sensitive queries. Max 2/page.
  if (!sensitive) {
    let promoted = 0;
    for (let i = scored.length - 1; i > 0 && promoted < 2; i--) {
      const s = scored[i];
      if (s.it.sponsored && s.compliance >= scored[i - 1].compliance) {
        scored.splice(i, 1);
        scored.splice(Math.max(0, i - 2), 0, s);
        promoted++;
      }
    }
  }

  return scored.map((s) => s.it);
}
