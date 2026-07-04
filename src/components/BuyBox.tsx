"use client";

// Product purchase actions — real API calls with visible loading/error/retry
// states. Clearly handles: signed-out, out-of-stock, backend-unavailable.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bitcoin, Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import type { ProductVariant } from "@/lib/types";

export function BuyBox({
  vendorName,
  vendorSlug,
  variants,
  purchasable,
  unavailableReason,
}: {
  vendorName: string;
  vendorSlug: string;
  variants: Pick<ProductVariant, "id" | "name" | "priceCents" | "stock" | "wholesaleOnly">[];
  purchasable: boolean;
  unavailableReason?: string;
}) {
  const router = useRouter();
  const retail = variants.filter((v) => !v.wholesaleOnly);
  const [variantId, setVariantId] = useState(retail[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "adding" | "added" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const selected = retail.find((v) => v.id === variantId);

  if (!purchasable) {
    return (
      <div className="rounded-lg border border-ink-600 bg-ink-800/60 px-4 py-3 text-sm text-mist-300">
        {unavailableReason ??
          "Purchasing is not yet enabled for this listing. Browse stays open while the marketplace beta completes."}
      </div>
    );
  }
  if (retail.length === 0) {
    return (
      <div className="rounded-lg border border-ink-600 bg-ink-800/60 px-4 py-3 text-sm text-mist-300">
        This listing is wholesale-only. Request wholesale access from the store page.
      </div>
    );
  }

  async function addToCart(thenCheckout: boolean) {
    if (!selected) return;
    setState("adding");
    setError(null);
    try {
      const res = await fetch("/marketplace/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selected.id, quantity: 1 }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("sign-in");
        setState("error");
        return;
      }
      if (!res.ok) {
        setError(body?.error?.message ?? "Could not add to cart.");
        setState("error");
        return;
      }
      setState("added");
      if (thenCheckout) router.push(`/cart?vendor=${vendorSlug}`);
    } catch {
      setError("Network error — please retry.");
      setState("error");
    }
  }

  return (
    <div className="space-y-4">
      {retail.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Variant">
          {retail.map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={v.id === variantId}
              onClick={() => setVariantId(v.id)}
              disabled={v.stock === 0}
              className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                v.id === variantId
                  ? "border-jade-500 bg-jade-500/10 text-jade-300"
                  : "border-ink-600 bg-ink-800 text-mist-300 hover:border-jade-500/50"
              }`}
            >
              {v.name} · {formatPrice(v.priceCents)}
              {v.stock === 0 && " · out of stock"}
            </button>
          ))}
        </div>
      )}

      {selected && selected.stock === 0 ? (
        <div className="rounded-lg border border-ink-600 bg-ink-800/60 px-4 py-3 text-sm text-mist-300">
          Out of stock. Check back — inventory counts here are real, not decorative.
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="flex-1" disabled={state === "adding"} onClick={() => addToCart(false)}>
            {state === "adding" ? (
              "Adding…"
            ) : state === "added" ? (
              <><Check className="h-4 w-4" aria-hidden /> In your {vendorName} cart</>
            ) : (
              <><ShoppingCart className="h-4 w-4" aria-hidden /> Add to {vendorName} cart</>
            )}
          </Button>
          <Button size="lg" variant="btc" disabled={state === "adding"} onClick={() => addToCart(true)}>
            <Bitcoin className="h-4 w-4" aria-hidden /> Checkout with BTC / Lightning
          </Button>
        </div>
      )}

      {state === "added" && (
        <p className="text-sm text-jade-300">
          Added. <Link href={`/cart?vendor=${vendorSlug}`} className="underline">Go to checkout →</Link>
        </p>
      )}
      {error === "sign-in" ? (
        <p className="text-sm text-amber-glow" role="alert">
          <Link href="/auth/sign-in" className="font-semibold underline">Sign in</Link> or{" "}
          <Link href="/auth/sign-up" className="font-semibold underline">create an account</Link> to buy — carts are
          saved to your account.
        </p>
      ) : (
        error && (
          <p className="text-sm text-signal-red" role="alert">
            {error}{" "}
            <button onClick={() => addToCart(false)} className="font-semibold underline">Retry</button>
          </p>
        )
      )}
    </div>
  );
}
