import type { Metadata } from "next";
import { getVendors, searchProducts } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [results, vendors] = await Promise.all([
    q ? searchProducts(q) : Promise.resolve([]),
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
      <div className="mt-8">
        {results.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} vendor={vendorMap.get(p.vendorSlug)} />
            ))}
          </div>
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
