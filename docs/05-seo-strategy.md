# SEO & AI-Search Strategy

## Principles

1. WordPress keeps every existing URL and ranking — the marketplace only adds
   `/marketplace/*` paths on the same domain (path, not subdomain → inherits
   full domain authority).
2. Every public marketplace page: SSR/ISR, indexable, canonical, schema-rich,
   information-dense, fast (target LCP < 1.8s, CLS < 0.05).
3. Restricted destinations never de-index a page — eligibility is a UI notice,
   not a robots rule.
4. Facts over fluff: structured cannabinoid data, named labs, verification
   status, shipping origin, policies — the exact fields AI answer engines quote.

## Page-type playbook

| Page | Schema (JSON-LD) | Content blocks |
|---|---|---|
| Home | Organization, WebSite+SearchAction, FAQPage | trust pillars, verified categories/brands, COA explainer, BTC explainer, FAQ |
| Category | CollectionPage, BreadcrumbList, FAQPage, ItemList | intro (unique, factual), grid, filters, compliance explainer, FAQ, related categories + editorial guides + state pages |
| Product | Product+Offer(+shippingDetails), AggregateRating+Review, BreadcrumbList, FAQPage | factual summary ("what this is" for AI engines), cannabinoid table, COA panel, badges, policies, related content |
| Storefront | Organization/Store(OnlineStore), BreadcrumbList, ItemList, AggregateRating | brand facts panel (type, location, joined, verification), catalog, policies, seller FAQ |
| Legal/policy | WebPage | plain-language policies (linked from every transactional surface) |

Merchant-listing compatibility: Offer includes price, priceCurrency,
availability, itemCondition, shippingDetails, hasMerchantReturnPolicy.

## URL & metadata

- Canonicals: `https://buyhempflowernearme.com/marketplace/...` (basePath keeps
  these automatic).
- Dynamic `generateMetadata` per page: title patterns
  `"{Product} — {Brand} | BHFNM Marketplace"`, factual descriptions from
  structured fields, OG images (brand/product imagery).
- Breadcrumbs on every page, mirrored in BreadcrumbList schema.

## Sitemaps & robots

- `/marketplace/sitemap.xml` — index → products / stores / categories sitemaps
  (built in `app/sitemap.ts`, chunked at 45k URLs).
- WordPress sitemap untouched. Add the marketplace sitemap index to GSC and
  reference it from the root `robots.txt` on WordPress:
  `Sitemap: https://buyhempflowernearme.com/marketplace/sitemap.xml`
- Marketplace `robots.ts` disallows: `/vendor-dashboard`, `/admin`, `/account`,
  `/orders`, `/messages`, `/disputes`, `/api`, checkout/cart paths.

## Internal-linking mesh

- Product → its category, its store, related products (same category / same
  seller), relevant WordPress guides (COA education, state legality page for
  shipping origin, comparison pages).
- Category → child/sibling categories, buyer guides, state hub, vendor CTA.
- Storefront → categories sold, state page for vendor location, wholesale page.
- WordPress side (editorial task, post-launch): add contextual links from the
  state/COA/comparison guides into matching marketplace categories — highest-
  leverage single SEO action after launch.

## Search & ranking (on-site, Meilisearch)

Composite ranking (implemented in `lib/ranking.ts`, mirrored into Meilisearch
custom ranking attributes):

```
rank = compliance_gate (hard filter: no expired COA in sensitive queries)
     → listing_health_score desc
     → seller_verification tier desc
     → text relevance
     → review bayesian score desc
     → shipping performance desc
     → inventory reliability desc
     → destination eligibility boost
```
Sponsored slots: clearly labeled, trust-gated (`sponsored_eligible`), capped at
2 per result page, never above verified higher-health listings in
compliance-sensitive queries (flower/THCA/vapes categories).

## AI-search optimization

- Every product/store page renders a deterministic "Facts" block (definition
  list): cannabinoid values, batch, lab, test date, verification status,
  shipping origin, handling time — machine-readable in both DOM and JSON-LD.
- Semantic heading hierarchy (single H1, question-form H2s in FAQs).
- Entity consistency: brand names, lab names, category names identical across
  DOM, schema, sitemaps.
- No unverifiable claims ("legal in all 50 states" never appears; verification
  status language only).
