# Phased Roadmap, UI Inventory & Wireframes

## Roadmap

### Phase 1 — Foundation (this repo, now)
Next.js app under /marketplace • Supabase schema + RLS • roles • age gate •
homepage, categories, product, storefront (SSR + schema) • vendor application
(6 steps, autosave) • admin review queues • draft product upload • structured
compliance objects • seed-backed search + facets • sitemaps/robots.
**Exit:** app deployed behind CF Worker, vendors can apply, admin can approve, catalog browsable + indexable.

### Phase 2 — Commerce
Vendor-scoped carts • checkout API • BTCPay invoices (on-chain + LN) • webhook
state sync • payment ledger • commission engine (12% default + overrides) •
buyer + vendor order dashboards.
**Exit:** first real BTC order settles end-to-end on staging (regtest) then prod.

### Phase 3 — Fulfillment & trust
Shipping label adapter (EasyPost) • acceptance-scan gate on "shipped" •
tracking timeline • messaging + moderation detectors • disputes • verified
reviews • payout queue + rolling reserves • fraud flags + risk dashboard.

### Phase 4 — Growth
Wholesale workflows (buyer business profiles, vendor approval, tiers/MOQ) •
CSV/Shopify/Woo importers (drafts only) • sponsored + featured placements
(trust-gated) • analytics dashboards • referral attribution • private-label requests.

### Phase 5 — Expansion
More payment adapters • automated payouts • more carriers • Canada province
rules • cross-border rule packs • public API • mobile-app readiness (API-first) •
AI support tooling.

## UI component inventory

**Primitives (`components/ui/`):** Button, Badge, Card, Input, Select, Textarea,
Checkbox, Tabs, Dialog, Sheet, Tooltip, Progress, Table, Stat, EmptyState,
Skeleton, Stepper, Alert.

**Marketplace (`components/`):** SiteHeader, SiteFooter, AgeGate, SearchBar,
ProductCard, ProductGrid, FilterSidebar, TrustBadge (+BadgeRow), CannabinoidTable,
CoaPanel, PriceBlock, VariantSelector, AvailabilityNotice, ShippingTimeline,
ReviewList/ReviewStars, StoreHero, StoreFactsPanel, FaqAccordion, Breadcrumbs,
SectionHeading, CtaBand, DashboardShell (vendor/admin/buyer variants),
QueueTable, StatusPill, LedgerTable, MessageThread, DisputeTimeline,
OnboardingStepper, JsonLd.

## Wireframes (structure per key page)

### Homepage
```
[Header: logo ◂ back-to-main-site | Categories | Wholesale | Sell | Search | Account]
[HERO dark gradient: H1 "The compliance-first hemp marketplace"
  sub: verified sellers • batch-linked COAs • BTC checkout | [Search bar] |
  trust stats row: verified vendors / verified COAs / tracked orders]
[Verified categories — card row]
[Trending products — ProductCard grid 4×]
[Featured verified brands — logo cards + badges]
[Why BHFNM — 4 pillars: Verified sellers / Structured COAs / Tracked fulfillment / Buyer protection]
[COA explainer band → links to WP education hub]
[BTC + Lightning explainer band]
[Wholesale suppliers strip]
[Seller CTA band: "Apply to sell" | Buyer protection CTA]
[SEO content block + FAQ accordion]
[Footer: policies, education links, state hub links]
```

### Category page
```
[Breadcrumbs] [H1 + factual intro]
[FilterSidebar: cannabinoid type, potency ranges, price, verification badges,
 vendor type, ships-from, rating, wholesale] | [sort] [ProductGrid]
[Compliance explainer] [FAQ] [Related categories / guides / state pages] [Vendor CTA]
```

### Product page
```
[Breadcrumbs]
[Gallery] | [Title, brand→store link, badges row, rating,
             price + variant selector + stock, ships-from + handling + delivery est,
             AvailabilityNotice(destination), Add-to-cart(vendor cart), BTC/LN note]
[Tabs: Details | COA & Compliance (CannabinoidTable + CoaPanel + batch/lot) |
       Shipping & Policies | Reviews(verified)]
[Facts block (AI-readable dl)] [Report listing]
[Related products / same-seller / education links]
```

### Storefront
```
[Cover + logo + brand H1 + badges + verification status]
[StoreFactsPanel: type, location, joined, products, rating, ship performance,
 response time, wholesale/private-label]
[Catalog grid + category chips] [Policies] [Seller FAQ] [Reviews]
[Contact → marketplace inbox only] [SEO block]
```

### Vendor onboarding
```
[OnboardingStepper 1–6] [step form, autosave indicator]
[right rail: requirements checklist + why-we-verify]
[final: application status page w/ missing items + admin Q&A thread]
```

### Vendor dashboard
```
[side nav: Overview Products Orders Compliance Payouts Messages Wholesale]
[Overview: stat cards (sales, pending orders, health hints, payout eligible),
 action queue (orders to ship, COAs expiring, changes requested)]
```

### Buyer order page
```
[order header + StatusPill] [items] [payment summary (BTC txid, invoice)]
[ShippingTimeline] [dispute window countdown → open-dispute CTA]
[message vendor] [review CTA when completed]
```

### Dispute page
```
[DisputeTimeline states] [evidence uploads both parties]
[order/shipping/COA context panel] [admin decision panel (admin view)]
```

### Admin dashboard
```
[side nav: Overview Vendors Products Compliance Orders Disputes Payouts Reports]
[Overview: queue counts + risk alerts feed]
[each section: QueueTable + detail drawer + decision actions (audited)]
```
