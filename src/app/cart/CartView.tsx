"use client";

// Vendor-scoped carts + real BTC checkout. Every state is explicit:
// signed-out, empty, loading, destination-restricted, payment-server errors.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bitcoin, Trash2 } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { formatPrice } from "@/lib/utils";

interface CartItem {
  id: string;
  quantity: number;
  variant: {
    id: string; name: string; price_cents: number; stock: number;
    product: { slug: string; title: string; status: string } | null;
  } | null;
}
interface Cart {
  id: string;
  vendor: { slug: string; brand_name: string } | null;
  items: CartItem[];
}

const US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");
const CA_PROVINCES = "AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" ");

export function CartView() {
  const [carts, setCarts] = useState<Cart[] | null>(null);
  const [authState, setAuthState] = useState<"loading" | "in" | "out">("loading");
  const [country, setCountry] = useState("US");
  const [region, setRegion] = useState("");
  const [busyVendor, setBusyVendor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/marketplace/api/cart");
      if (res.status === 401) {
        setAuthState("out");
        return;
      }
      const body = await res.json();
      setAuthState("in");
      setCarts((body.carts as Cart[]).filter((c) => c.items.length > 0));
    } catch {
      setError("Could not load your cart — refresh to retry.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setQuantity(variantId: string, quantity: number) {
    await fetch("/marketplace/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, quantity }),
    });
    load();
  }

  async function checkout(vendorSlug: string) {
    if (!region) {
      setError("Select your state/province first — checkout eligibility depends on it.");
      return;
    }
    setBusyVendor(vendorSlug);
    setError(null);
    try {
      const res = await fetch("/marketplace/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorSlug, destination: { country, region }, idempotencyKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? "Checkout failed — nothing was charged.");
        return;
      }
      // Real BTCPay invoice — hand the buyer to the payment page.
      window.location.href = body.checkoutLink;
    } catch {
      setError("Network error — nothing was charged. Please retry.");
    } finally {
      setBusyVendor(null);
    }
  }

  if (authState === "out") {
    return (
      <div className="mt-10">
        <EmptyState
          title="Sign in to see your cart"
          sub="Carts are saved to your account so they follow you across devices."
          action={
            <Link href="/auth/sign-in?next=/cart" className="text-sm font-semibold text-jade-300 underline">
              Sign in →
            </Link>
          }
        />
      </div>
    );
  }
  if (carts === null) {
    return <p className="mt-10 text-sm text-mist-400">Loading your cart…</p>;
  }
  if (carts.length === 0) {
    return (
      <div className="mt-10">
        <EmptyState
          title="Your cart is empty"
          sub="Only live, admin-approved listings can be added."
          action={<Link href="/" className="text-sm font-semibold text-jade-300 underline">Browse the marketplace →</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Destination — drives the jurisdiction rules engine at checkout */}
      <div className="card-surface rounded-card p-5">
        <h2 className="text-sm font-semibold text-mist-100">Shipping destination</h2>
        <div className="mt-3 flex gap-3">
          <select aria-label="Country" value={country} onChange={(e) => { setCountry(e.target.value); setRegion(""); }}
            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100">
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
          <select aria-label="State or province" value={region} onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-mist-100">
            <option value="">State/province…</option>
            {(country === "US" ? US_STATES : CA_PROVINCES).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <p className="mt-2 text-[11px] text-mist-400">
          Eligibility is checked per product against your destination when you check out.
        </p>
      </div>

      {carts.map((cart) => {
        const subtotal = cart.items.reduce(
          (s, i) => s + (i.variant ? i.variant.price_cents * i.quantity : 0), 0);
        return (
          <div key={cart.id} className="card-surface rounded-card p-5">
            <h2 className="font-display text-lg font-bold text-mist-100">
              {cart.vendor?.brand_name ?? "Store"}
              <Link href={`/store/${cart.vendor?.slug}`} className="ml-2 text-xs font-normal text-jade-300 hover:underline">
                visit store
              </Link>
            </h2>
            <ul className="mt-4 divide-y divide-ink-700">
              {cart.items.map((item) => {
                const v = item.variant;
                if (!v || !v.product) return null;
                return (
                  <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link href={`/product/${v.product.slug}`} className="font-medium text-mist-100 hover:text-jade-300">
                        {v.product.title}
                      </Link>
                      <p className="text-xs text-mist-400">{v.name} · {formatPrice(v.price_cents)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Quantity"
                        value={item.quantity}
                        onChange={(e) => setQuantity(v.id, parseInt(e.target.value, 10))}
                        className="rounded-lg border border-ink-600 bg-ink-800 px-2 py-1 text-sm text-mist-100"
                      >
                        {Array.from({ length: Math.min(10, Math.max(v.stock, 1)) }, (_, n) => n + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button aria-label={`Remove ${v.product.title}`} onClick={() => setQuantity(v.id, 0)}
                        className="rounded-lg p-2 text-mist-400 hover:bg-ink-800 hover:text-signal-red">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="w-20 text-right font-semibold text-mist-100">
                      {formatPrice(v.price_cents * item.quantity)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-4">
              <span className="text-sm text-mist-300">Subtotal <strong className="text-mist-100">{formatPrice(subtotal)}</strong></span>
              <Button variant="btc" disabled={busyVendor !== null} onClick={() => checkout(cart.vendor!.slug)}>
                <Bitcoin className="h-4 w-4" aria-hidden />
                {busyVendor === cart.vendor?.slug ? "Creating invoice…" : "Checkout with BTC / Lightning"}
              </Button>
            </div>
          </div>
        );
      })}

      {error && (
        <p role="alert" className="rounded-lg bg-signal-red/10 px-4 py-3 text-sm text-signal-red">{error}</p>
      )}
      <p className="text-[11px] leading-relaxed text-mist-400">
        Checkout creates a Bitcoin invoice on our self-hosted payment server (on-chain and Lightning). Your order
        confirms automatically when payment settles. Vendors are paid only after delivery and the dispute window
        complete.
      </p>
    </div>
  );
}
