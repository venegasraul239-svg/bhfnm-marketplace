import type { Metadata } from "next";
import { Suspense } from "react";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Cart — BHFNM Marketplace", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-black text-mist-100">Your carts</h1>
      <p className="mt-2 text-sm text-mist-400">
        Carts are per-store: each order is placed with, paid to, and fulfilled by a single verified vendor.
      </p>
      <Suspense>
        <CartView />
      </Suspense>
    </div>
  );
}
