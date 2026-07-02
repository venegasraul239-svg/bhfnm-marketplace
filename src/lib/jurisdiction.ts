// Checkout-eligibility rules engine.
//
// Decides, per (destination × product), whether checkout is allowed, denied,
// or allowed-with-notice. Product pages are NEVER hidden by this engine —
// restricted destinations get an availability notice, keeping pages indexable.
//
// Rule precedence (most specific wins):
//   product.restrictedJurisdictions  >  admin jurisdiction_rules
//   (region-specific > country-wide)  >  cross-border default-deny  >  launch allowlist
//
// The same logic runs against DB rows in production (jurisdiction_rules table);
// this module encodes the defaults and the evaluation order.

import type { JurisdictionDecision, Product } from "./types";

export interface Destination {
  country: string;         // ISO-3166 alpha-2
  region?: string;         // state/province code
}

const LAUNCH_COUNTRIES = new Set(["US", "CA"]);

export function evaluateCheckoutEligibility(
  product: Pick<Product, "restrictedJurisdictions" | "cannabinoidType" | "shippingOrigin" | "ageRestricted">,
  destination: Destination
): JurisdictionDecision {
  // 1. Launch geography: only US + CA can check out at all.
  if (!LAUNCH_COUNTRIES.has(destination.country)) {
    return {
      eligible: false,
      effect: "deny",
      notice:
        "Checkout is currently available in the United States and Canada. This listing remains visible worldwide for research.",
    };
  }

  // 2. Product-level destination restrictions (vendor-declared, admin-reviewed).
  for (const r of product.restrictedJurisdictions) {
    if (r.country !== destination.country) continue;
    if (!r.region || r.region === destination.region) {
      return {
        eligible: false,
        effect: "deny",
        notice: r.region
          ? `This product cannot be shipped to ${r.region}, ${r.country}. It remains visible for research.`
          : `This product cannot be shipped to ${r.country === "CA" ? "Canada" : "the United States"}. It remains visible for research.`,
      };
    }
  }

  // 3. Cross-border cannabinoid orders: denied by default unless an explicit
  //    admin allow rule exists (none at launch).
  const isCannabinoid = product.cannabinoidType !== "none";
  if (isCannabinoid && product.shippingOrigin.country !== destination.country) {
    return {
      eligible: false,
      effect: "deny",
      notice:
        "Cross-border cannabinoid orders are not available. This seller ships within " +
        (product.shippingOrigin.country === "CA" ? "Canada" : "the United States") +
        " only.",
    };
  }

  // 4. Age-restricted note (informational; the age gate handles enforcement).
  if (product.ageRestricted) {
    return { eligible: true, effect: "notice_only", notice: "21+ only. Signature may be required on delivery." };
  }

  return { eligible: true, effect: "allow" };
}
