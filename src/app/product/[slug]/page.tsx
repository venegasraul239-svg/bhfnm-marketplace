import type { Metadata } from "next";
import Link from "next/link";
import { SafeImage } from "@/components/SafeImage";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getCategory, getProduct, getProducts, getReviews, getVendor } from "@/lib/data";
import { evaluateCheckoutEligibility } from "@/lib/jurisdiction";
import { formatDate, formatPrice } from "@/lib/utils";
import { Breadcrumbs, Button, FaqAccordion, SectionHeading, StatusPill } from "@/components/ui";
import { BadgeRow } from "@/components/TrustBadge";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, faqSchema, productSchema } from "@/lib/schema-org";
import { Bitcoin, Flag, MapPin, ShieldCheck, Star, Timer, Truck } from "lucide-react";
import type { PanelResult } from "@/lib/types";

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const vendor = await getVendor(product.vendorSlug);
  return {
    title: `${product.title} — ${vendor?.brandName ?? "Verified Seller"}`,
    description: product.shortDescription,
    alternates: { canonical: `/marketplace/product/${product.slug}` },
    openGraph: { images: product.images[0] ? [product.images[0].url] : [] },
  };
}

const PANEL_LABEL: Record<PanelResult, { text: string; tone: "ok" | "bad" | "neutral" | "warn" }> = {
  pass: { text: "Pass", tone: "ok" },
  fail: { text: "Fail", tone: "bad" },
  not_tested: { text: "Not tested", tone: "neutral" },
  pending: { text: "Pending", tone: "warn" },
};

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [vendor, category, reviews, sameSeller, sameCategory] = await Promise.all([
    getVendor(product.vendorSlug),
    getCategory(product.categorySlug),
    getReviews({ product: slug }),
    getProducts({ vendor: product.vendorSlug }),
    getProducts({ category: product.categorySlug }),
  ]);
  if (!vendor || !category) notFound();

  // Destination from the age-gate cookie (defaults to US-wide view).
  const jar = await cookies();
  const dest = jar.get("bhfnm-dest")?.value?.split("-") ?? ["US", ""];
  const decision = evaluateCheckoutEligibility(product, { country: dest[0], region: dest[1] || undefined });

  const retailVariants = product.variants.filter((v) => !v.wholesaleOnly);
  const c = product.compliance;
  const crumbs = [
    { name: "Marketplace", href: "/" },
    { name: category.name, href: `/categories/${category.slug}` },
    { name: product.title },
  ];
  const related = sameCategory.filter((p) => p.slug !== slug).slice(0, 4);
  const more = sameSeller.filter((p) => p.slug !== slug).slice(0, 4);

  return (
    <>
      <JsonLd
        data={[
          productSchema(product, vendor, reviews),
          breadcrumbSchema(crumbs.map((cr) => ({ name: cr.name, href: cr.href ?? `/product/${slug}` }))),
          ...(product.faqs?.length ? [faqSchema(product.faqs)] : []),
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Breadcrumbs items={crumbs} />

        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          {/* Gallery */}
          <div className="space-y-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-ink-700 bg-ink-800">
              {product.images[0] && (
                <SafeImage src={product.images[0].url} alt={product.images[0].alt} fill priority sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
              )}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.slice(1).map((img, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-ink-700 bg-ink-800">
                    <SafeImage src={img.url} alt={img.alt} fill sizes="12vw" className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buy panel */}
          <div>
            <Link href={`/store/${vendor.slug}`} className="text-xs font-semibold uppercase tracking-wider text-jade-400 hover:text-jade-300">
              {vendor.brandName}
            </Link>
            <h1 className="mt-1 font-display text-2xl font-black text-mist-100 sm:text-3xl text-balance">{product.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-mist-400">
              {product.ratingCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-glow text-amber-glow" aria-hidden />
                  <span className="font-semibold text-mist-200">{product.ratingAvg.toFixed(1)}</span>
                  ({product.ratingCount} verified reviews)
                </span>
              )}
              {product.subtype && <span>· {product.subtype}</span>}
              {c && <span>· Batch {c.batchNumber}</span>}
            </div>

            <div className="mt-4">
              <BadgeRow badges={product.badges} />
            </div>

            {/* Variants */}
            <div className="mt-6 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-mist-300">Options</h2>
              {retailVariants.map((v, i) => (
                <label
                  key={v.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-ink-600 bg-ink-800/60 px-4 py-3 transition-colors has-[:checked]:border-jade-500"
                >
                  <span className="flex items-center gap-3">
                    <input type="radio" name="variant" defaultChecked={i === 0} className="accent-jade-500" />
                    <span className="text-sm font-medium text-mist-100">{v.name}</span>
                    <span className="text-xs text-mist-400">SKU {v.sku}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-bold text-mist-100">{formatPrice(v.priceCents)}</span>
                    <StatusPill tone={v.stock > 10 ? "ok" : v.stock > 0 ? "warn" : "bad"}>
                      {v.stock > 10 ? "In stock" : v.stock > 0 ? `${v.stock} left` : "Out of stock"}
                    </StatusPill>
                  </span>
                </label>
              ))}
            </div>

            {/* Availability + checkout */}
            <div className="mt-5 space-y-3">
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
              {decision.eligible ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" className="flex-1">Add to {vendor.brandName} cart</Button>
                  <Button size="lg" variant="btc" className="flex-1">
                    <Bitcoin className="h-4 w-4" aria-hidden /> Checkout with BTC / Lightning
                  </Button>
                </div>
              ) : (
                <Button size="lg" variant="secondary" disabled className="w-full">
                  Checkout unavailable for your destination
                </Button>
              )}
              <p className="text-[11px] leading-relaxed text-mist-400">
                Single-vendor checkout: each order is fulfilled and shipped by {vendor.brandName} with a
                platform-generated tracked label. Payment settles via self-hosted BTCPay (on-chain or Lightning).
                Buyer protection applies for 48 hours after delivery.
              </p>
            </div>

            {/* Shipping facts */}
            <dl className="mt-6 grid grid-cols-1 gap-3 rounded-card border border-ink-700 bg-ink-900/50 p-5 text-sm sm:grid-cols-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-jade-400" aria-hidden />
                <div>
                  <dt className="text-xs text-mist-400">Ships from</dt>
                  <dd className="font-medium text-mist-200">{product.shippingOrigin.region}, {product.shippingOrigin.country}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-jade-400" aria-hidden />
                <div>
                  <dt className="text-xs text-mist-400">Handling time</dt>
                  <dd className="font-medium text-mist-200">{product.handlingDaysMin}–{product.handlingDaysMax} business days</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-jade-400" aria-hidden />
                <div>
                  <dt className="text-xs text-mist-400">Estimated delivery</dt>
                  <dd className="font-medium text-mist-200">{product.handlingDaysMin + 2}–{product.handlingDaysMax + 5} days, tracked</dd>
                </div>
              </div>
            </dl>

            {product.wholesaleAvailable && (
              <div className="mt-4 flex items-center justify-between rounded-card border border-jade-500/25 bg-jade-500/5 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-mist-100">Wholesale available</p>
                  <p className="text-xs text-mist-400">MOQ {product.wholesaleMoq ?? 1} · tiered pricing for approved wholesale buyers</p>
                </div>
                <Button href={`/store/${vendor.slug}`} variant="secondary" size="sm">Request access</Button>
              </div>
            )}
          </div>
        </div>

        {/* Compliance panel */}
        <section className="mt-14">
          <SectionHeading eyebrow="Compliance" title="Lab results & batch data" />
          {c ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="overflow-hidden rounded-card border border-ink-700">
                <table className="w-full text-sm">
                  <caption className="sr-only">Cannabinoid results for batch {c.batchNumber}</caption>
                  <thead>
                    <tr className="border-b border-ink-700 bg-ink-900/60 text-left text-xs uppercase tracking-wider text-mist-400">
                      <th className="px-5 py-3 font-semibold">Analyte / panel</th>
                      <th className="px-5 py-3 font-semibold">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-800">
                    {c.delta9ThcPct !== undefined && <tr><td className="px-5 py-3 text-mist-300">Delta-9 THC</td><td className="px-5 py-3 font-mono text-mist-100">{c.delta9ThcPct}%</td></tr>}
                    {c.totalThcPct !== undefined && <tr><td className="px-5 py-3 text-mist-300">Total THC</td><td className="px-5 py-3 font-mono text-mist-100">{c.totalThcPct}%</td></tr>}
                    {c.thcaPct !== undefined && <tr><td className="px-5 py-3 text-mist-300">THCA</td><td className="px-5 py-3 font-mono text-mist-100">{c.thcaPct}%</td></tr>}
                    {c.cbdPct !== undefined && c.cbdPct > 0 && <tr><td className="px-5 py-3 text-mist-300">CBD</td><td className="px-5 py-3 font-mono text-mist-100">{c.cbdPct}%</td></tr>}
                    {c.cbgPct !== undefined && c.cbgPct > 0 && <tr><td className="px-5 py-3 text-mist-300">CBG</td><td className="px-5 py-3 font-mono text-mist-100">{c.cbgPct}%</td></tr>}
                    {c.otherCannabinoids && Object.entries(c.otherCannabinoids).map(([k, v]) => (
                      <tr key={k}><td className="px-5 py-3 text-mist-300">{k}</td><td className="px-5 py-3 font-mono text-mist-100">{v}</td></tr>
                    ))}
                    {([
                      ["Pesticides", c.pesticides],
                      ["Heavy metals", c.heavyMetals],
                      ["Microbials", c.microbials],
                      ["Residual solvents", c.residualSolvents],
                      ["Foreign material", c.foreignMaterial],
                    ] as [string, PanelResult][]).map(([label, r]) => (
                      <tr key={label}>
                        <td className="px-5 py-3 text-mist-300">{label}</td>
                        <td className="px-5 py-3"><StatusPill tone={PANEL_LABEL[r].tone}>{PANEL_LABEL[r].text}</StatusPill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-surface h-fit rounded-card p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-jade-400" aria-hidden />
                  <h3 className="font-semibold text-mist-100">COA verification</h3>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-xs text-mist-400">Status</dt><dd><StatusPill tone={c.status === "verified" ? "ok" : c.status === "expired" ? "bad" : "warn"}>{c.status === "verified" ? `Verified ${c.verifiedAt ? formatDate(c.verifiedAt) : ""}` : c.status.replace(/_/g, " ")}</StatusPill></dd></div>
                  <div><dt className="text-xs text-mist-400">Batch / lot</dt><dd className="font-mono text-mist-200">{c.batchNumber}</dd></div>
                  <div><dt className="text-xs text-mist-400">Laboratory</dt><dd className="text-mist-200">{c.labName}</dd></div>
                  <div><dt className="text-xs text-mist-400">COA issued</dt><dd className="text-mist-200">{formatDate(c.coaIssueDate)}</dd></div>
                  {c.retestDate && <div><dt className="text-xs text-mist-400">Retest by</dt><dd className="text-mist-200">{formatDate(c.retestDate)}</dd></div>}
                  {c.coaFileHash && <div><dt className="text-xs text-mist-400">File integrity (SHA-256)</dt><dd className="font-mono text-xs text-mist-300">{c.coaFileHash}</dd></div>}
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-mist-400">
                  Verification means marketplace compliance reviewed this COA against the structured data above.
                  Learn to read COAs on the{" "}
                  <a href="https://buyhempflowernearme.com/how-to-read-a-hemp-coa/" className="text-jade-300 underline">education hub</a>.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-mist-400">This product category does not require a COA (non-cannabinoid item).</p>
          )}
        </section>

        {/* Description + facts */}
        <section className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Details" title="About this product" />
            <p className="mt-5 text-sm leading-relaxed text-mist-300">{product.description}</p>
          </div>
          <div>
            <SectionHeading eyebrow="At a glance" title="Product facts" />
            <dl className="mt-5 divide-y divide-ink-800 rounded-card border border-ink-700">
              {Object.entries(product.facts).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-6 px-5 py-3 text-sm">
                  <dt className="text-mist-400">{k}</dt>
                  <dd className="text-right font-medium text-mist-100">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-14">
          <SectionHeading eyebrow="Verified reviews" title={`Reviews (${reviews.length})`} sub="Only buyers with completed orders can review. Sellers cannot edit or remove reviews." />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {reviews.map((r) => (
              <article key={r.id} className="card-surface rounded-card p-5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-amber-glow" aria-label={`${r.ratingOverall} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.ratingOverall ? "fill-amber-glow" : "text-ink-600"}`} aria-hidden />
                    ))}
                  </span>
                  {r.verifiedPurchase && <StatusPill tone="ok">Verified purchase</StatusPill>}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-mist-100">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-400">{r.body}</p>
                <p className="mt-3 text-xs text-mist-400">{r.author} · {formatDate(r.createdAt)}</p>
              </article>
            ))}
            {reviews.length === 0 && <p className="text-sm text-mist-400">No reviews yet for this listing.</p>}
          </div>
        </section>

        {product.faqs && product.faqs.length > 0 && (
          <section className="mt-14 max-w-3xl">
            <SectionHeading eyebrow="FAQ" title="Questions about this listing" />
            <div className="mt-6"><FaqAccordion faqs={product.faqs} /></div>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-14">
            <SectionHeading eyebrow="Related" title={`More in ${category.name}`} />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => <ProductCard key={p.id} product={p} vendor={vendor.slug === p.vendorSlug ? vendor : undefined} />)}
            </div>
          </section>
        )}
        {more.length > 0 && (
          <section className="mt-14">
            <SectionHeading eyebrow="Same seller" title={`More from ${vendor.brandName}`} />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {more.map((p) => <ProductCard key={p.id} product={p} vendor={vendor} />)}
            </div>
          </section>
        )}

        {/* Report */}
        <div className="mt-14 flex items-center justify-between rounded-card border border-ink-700 bg-ink-900/40 px-6 py-4">
          <p className="text-sm text-mist-400">See a compliance issue, wrong data, or suspicious listing?</p>
          <Link href={`/report?product=${product.slug}`} className="flex items-center gap-2 text-sm font-semibold text-mist-300 hover:text-signal-red">
            <Flag className="h-4 w-4" aria-hidden /> Report listing issue
          </Link>
        </div>
      </div>
    </>
  );
}
