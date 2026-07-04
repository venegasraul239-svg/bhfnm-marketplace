import type { Metadata } from "next";
import Link from "next/link";
import { getVendors, searchProducts, searchVendors } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import { BadgeRow } from "@/components/TrustBadge";
import { EmptyState } from "@/components/ui";
import { Store } from "lucide-react";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [results, storeMatches, vendors] = await Promise.all([
    q ? searchProducts(q) : Promise.resolve([]),
    q ? searchVendors(q) : Promise.resolve([]),
    getVendors(),
  ]);
  const vendorMap = new Map(vendors.map((v) => [v.slug, v]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-black text-mist-100">
        {q ? `Results for "${q}"` : "Search the marketplace"}
      </h1>
      <p className="mt-2 text-sm text-mist-400">
        Ranking prioritizes compliance quality, verified sellers, and listing health before anything else. Sponsored
        results are always labeled.
      </p>

      {storeMatches.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-mist-300">Matching stores</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {storeMatches.map((v) => (
              <Link
                key={v.slug}
                href={`/store/${v.slug}`}
                className="card-surface group flex items-center gap-3 rounded-card px-4 py-3 transition-colors hover:border-jade-500/50"
              >
                <Store className="h-5 w-5 shrink-0 text-mist-400 group-hover:text-jade-400" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-mist-100 group-hover:text-jade-300">
                    {v.brandName}
                  </span>
                  <span className="mt-0.5 block">
                    <BadgeRow badges={v.badges} max={2} size="sm" />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        {results.length > 0 ? (
          <>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-mist-300">
              Products ({results.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} vendor={vendorMap.get(p.vendorSlug)} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title={q ? "No verified listings matched" : "Type a product, brand, cannabinoid, or batch number"}
            sub={q ? "Try a broader term — only live, admin-approved listings are searchable." : undefined}
          />
        )}
      </div>
    </div>
  );
}
