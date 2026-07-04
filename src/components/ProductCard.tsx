import Link from "next/link";
import { SafeImage } from "./SafeImage";
import type { Product, Vendor } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { BadgeRow } from "./TrustBadge";
import { Star } from "lucide-react";

export function ProductCard({
  product,
  vendor,
  sponsored = false,
}: {
  product: Product;
  vendor?: Vendor;
  sponsored?: boolean;
}) {
  const retail = product.variants.filter((v) => !v.wholesaleOnly);
  const from = retail.length ? Math.min(...retail.map((v) => v.priceCents)) : Math.min(...product.variants.map((v) => v.priceCents));
  const img = product.images[0];

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group card-surface flex flex-col overflow-hidden rounded-card transition-colors hover:border-jade-500/50"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-800">
        {img && (
          <SafeImage
            src={img.url}
            alt={img.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        {sponsored && (
          <span className="absolute left-3 top-3 rounded bg-ink-950/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mist-300">
            Sponsored
          </span>
        )}
        {product.compliance?.status === "verified" && (
          <span className="absolute right-3 top-3 rounded-full bg-jade-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-950">
            Verified COA
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {vendor && <p className="text-[11px] font-medium uppercase tracking-wider text-mist-400">{vendor.brandName}</p>}
        <h3 className="text-sm font-semibold leading-snug text-mist-100 group-hover:text-jade-300">{product.title}</h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-mist-400">{product.shortDescription}</p>
        <BadgeRow badges={product.badges} max={2} size="sm" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-bold text-mist-100">
            from {formatPrice(from)}
          </span>
          {product.ratingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-mist-300">
              <Star className="h-3.5 w-3.5 fill-amber-glow text-amber-glow" aria-hidden />
              {product.ratingAvg.toFixed(1)}
              <span className="text-mist-400">({product.ratingCount})</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
