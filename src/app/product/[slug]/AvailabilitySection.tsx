"use client";

// Destination eligibility runs CLIENT-side from the age-gate cookie so the
// product page stays statically rendered (ISR) — cookies() in an ISR route
// 500s in production. Falls back to the US-wide view until hydration.

import { useEffect, useState } from "react";
import { evaluateCheckoutEligibility } from "@/lib/jurisdiction";
import type { Product } from "@/lib/types";
import { BuyBox } from "@/components/BuyBox";

export function AvailabilitySection({
  product,
  vendorName,
  vendorSlug,
  live,
}: {
  product: Product;
  vendorName: string;
  vendorSlug: string;
  live: boolean;
}) {
  const [dest, setDest] = useState<{ country: string; region?: string }>({ country: "US" });

  useEffect(() => {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("bhfnm-dest="))
      ?.split("=")[1];
    if (raw) {
      const [country, region] = decodeURIComponent(raw).split("-");
      if (country) setDest({ country, region: region || undefined });
    }
  }, []);

  const decision = evaluateCheckoutEligibility(product, dest);

  return (
    <div className="mt-6 space-y-3">
      {decision.notice && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            decision.eligible
              ? "border-ink-600 bg-ink-800/60 text-mist-300"
              : "border-amber-glow/40 bg-amber-glow/10 text-amber-glow"
          }`}
        >
          {decision.notice}
        </p>
      )}
      <BuyBox
        vendorName={vendorName}
        vendorSlug={vendorSlug}
        variants={product.variants}
        purchasable={decision.eligible && live}
        unavailableReason={
          !decision.eligible
            ? "Checkout is unavailable for your destination — the listing stays visible for research."
            : !live
              ? "This environment shows the sample catalog — purchasing is disabled outside the live marketplace."
              : undefined
        }
      />
    </div>
  );
}
