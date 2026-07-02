// Listing Health Score — internal 0–100 composite that drives search ranking,
// featured/sponsored eligibility, and quality-review priority.
//
// The raw score is NEVER exposed publicly. Public surfaces show derived trust
// indicators (badges) only. Vendors see improvement hints, not the number.

export interface HealthInputs {
  sellerVerificationComplete: boolean;   // identity + business + wallet
  coaAgeDays: number | null;             // null = no COA
  coaDataComplete: boolean;              // structured fields filled
  coaExpired: boolean;
  productInfoCompleteness: number;       // 0..1 required-field coverage
  imageCount: number;
  inventoryAccuracy: number;             // 0..1 (oversell rate inverse)
  onTimeShipRate: number;                // 0..1
  trackingScanReliability: number;       // 0..1 acceptance-scan rate
  deliverySuccessRate: number;           // 0..1
  disputeRate: number;                   // disputes / orders, rolling 90d
  returnRate: number;                    // 0..1
  reviewAvg: number | null;              // 1..5
  reviewCount: number;
  responseHours: number;                 // median seller response
  policyViolations90d: number;
  adminWarnings90d: number;
  complaints90d: number;
  delistings365d: number;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** Bayesian-smoothed review score so 2 five-star reviews don't beat 200 at 4.8. */
export function bayesianReview(avg: number | null, count: number, prior = 4.2, weight = 20): number {
  if (avg === null || count === 0) return prior;
  return (prior * weight + avg * count) / (weight + count);
}

export function computeHealthScore(i: HealthInputs): { score: number; components: Record<string, number> } {
  const components: Record<string, number> = {
    verification: i.sellerVerificationComplete ? 1 : 0.4,
    coaRecency: i.coaAgeDays === null ? 0 : i.coaExpired ? 0 : clamp(1 - i.coaAgeDays / 365),
    coaCompleteness: i.coaDataComplete ? 1 : 0.5,
    productCompleteness: clamp(i.productInfoCompleteness),
    images: clamp(i.imageCount / 3),
    inventory: clamp(i.inventoryAccuracy),
    shipping: clamp(i.onTimeShipRate),
    tracking: clamp(i.trackingScanReliability),
    delivery: clamp(i.deliverySuccessRate),
    disputes: clamp(1 - i.disputeRate * 10),        // 10% dispute rate → 0
    returns: clamp(1 - i.returnRate * 5),
    reviews: clamp((bayesianReview(i.reviewAvg, i.reviewCount) - 3) / 2),
    responsiveness: clamp(1 - i.responseHours / 48),
    conduct: clamp(1 - (i.policyViolations90d * 0.25 + i.adminWarnings90d * 0.15 + i.complaints90d * 0.05 + i.delistings365d * 0.3)),
  };

  const weights: Record<keyof typeof components, number> = {
    verification: 12, coaRecency: 12, coaCompleteness: 8, productCompleteness: 8,
    images: 4, inventory: 6, shipping: 10, tracking: 6, delivery: 8,
    disputes: 10, returns: 4, reviews: 8, responsiveness: 4, conduct: 10,
  } as const;

  let total = 0;
  let weightSum = 0;
  for (const [k, w] of Object.entries(weights)) {
    total += components[k] * w;
    weightSum += w;
  }
  return { score: Math.round((total / weightSum) * 100), components };
}

/** Trust gates for sponsored/featured placement — hard requirements, not score trades. */
export function sponsoredEligible(i: HealthInputs, openDisputes: number): boolean {
  return (
    i.sellerVerificationComplete &&
    !i.coaExpired &&
    openDisputes === 0 &&
    i.onTimeShipRate >= 0.9 &&
    i.policyViolations90d === 0
  );
}
