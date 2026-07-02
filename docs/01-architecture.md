# BHFNM Marketplace — Architecture

## 0. Audit findings (2026-07-02)

| Item | Finding |
|---|---|
| CMS | WordPress + WooCommerce (`/wp-json/` exposed, WooCommerce category routes) |
| Hosting | Hostinger (hPanel), LiteSpeed cache, PHP 8.3.30 |
| CDN | Cloudflare, proxied (orange cloud), `cf-cache-status: DYNAMIC`, speculation rules enabled |
| `/marketplace` | 404 today — path is unclaimed, safe to route to a new app |
| Content assets | State-law hub, COA education, cannabinoid comparisons, wholesale research pages — the SEO authority to preserve and interlink |
| Brand tone | COA-first, compliance-forward, educational, cautious |

**Consequence:** because Cloudflare already proxies the domain, we can serve the
marketplace from Vercel under `/marketplace*` with a Cloudflare Worker route —
zero changes to WordPress, zero DNS risk, zero impact on existing rankings.
See `08-deployment-wordpress-nextjs.md`.

## 1. System overview

```
                        ┌──────────────────────────────┐
  buyer / vendor / bot  │        Cloudflare (existing)  │
  ──────────────────────►  Worker route: /marketplace*  │
                        └──────┬────────────────┬──────┘
                               │                │ all other paths
                    /marketplace*               ▼
                               │        Hostinger origin
                               ▼        (WordPress/Woo — untouched,
                     Vercel (Next.js 15) editorial + state/COA content)
                     basePath=/marketplace
                               │
        ┌──────────┬───────────┼──────────────┬─────────────┐
        ▼          ▼           ▼              ▼             ▼
   Supabase    Supabase     Meilisearch   BTCPay Server  Shipping API
   Postgres    Auth+Storage (search/      (self-hosted:  (EasyPost/Shippo
   (RLS)       (COAs, docs,  facets)      BTC on-chain    adapter layer —
               evidence)                  + Lightning)    platform labels)
```

- **Next.js 15 (App Router, TS, Tailwind v4, shadcn-style components, Framer Motion)** — SSR/ISR public pages, client dashboards.
- **Supabase Postgres** — single source of truth; Row-Level Security enforces the permission matrix at the data layer, not just the UI.
- **Supabase Auth** — email+password (+ TOTP later), role claims in `profiles`.
- **Supabase Storage** (private buckets) — COAs, identity docs, shipping evidence, dispute evidence; signed URLs only; public bucket for product/brand imagery.
- **Meilisearch** — product/vendor indexes with compliance-weighted custom ranking (see `07-seo-strategy.md` §ranking and `lib/ranking.ts`).
- **BTCPay Server (self-hosted)** — Greenfield API; on-chain + Lightning; webhook-driven order state. Payments are never simulated: without BTCPay env config, checkout renders a "payments not yet enabled" state.
- **Shipping abstraction** — `lib/shipping/` port with carrier adapters (EasyPost first); platform generates every label, tracking events validated server-side.

## 2. Non-negotiable invariants (enforced in schema + RLS + service layer)

1. One order = one vendor. Carts are keyed by `(buyer, vendor)`. No mixed-vendor checkout.
2. Products are drafts until an admin review transitions them to `approved` → `live`. No vendor-initiated publish. Enforced by RLS: vendors cannot set `status` beyond `pending_review`.
3. Reviews are insert-only for buyers with a delivered order; vendors have no UPDATE/DELETE grant on `reviews`. Admin moderation is a status flag (`moderated_reason`), never deletion of the record.
4. Messages are immutable: no UPDATE/DELETE policies exist on `messages` for any non-service role.
5. Shipped state requires a platform-generated label row + a carrier acceptance scan event. There is no free-text tracking field on orders.
6. COAs are structured `compliance_records`, hash-verified files, admin-verified before any badge renders.
7. Payout eligibility is computed (delivered + dispute window closed + no holds + reserve schedule), never set directly by vendors.
8. Sponsored placement requires `sponsored_eligible = true`, derived from trust gates (no expired COAs, no open disputes, shipping SLA met).
9. Every privileged mutation writes `audit_logs` via triggers/service layer.
10. No off-platform contact: message content passes moderation detectors (emails, phones, wallets, Telegram/WhatsApp/Discord, external checkout URLs) before persistence; hits are stored flagged for admin.
11. Checkout eligibility is computed per (destination country/state/province × category × cannabinoid × vendor origin × admin rules) by the jurisdiction rules engine. Product pages stay indexable regardless; restricted destinations see availability notices, not hidden pages. Cross-border cannabinoid orders are denied by default.
12. No automatic legal-compliance claims anywhere in UI copy — the platform exposes *verification status* and configurable controls, not legal conclusions. The word "escrow" is not used publicly.

## 3. Application layout

```
src/
  app/            # App Router, basePath=/marketplace
    (public)/     # home, categories/[slug], product/[slug], store/[slug], search
    vendors/apply # multi-step onboarding
    vendor-dashboard/{products,orders,compliance,payouts,messages,wholesale}
    account, orders, messages, disputes          # buyer
    admin/{vendors,products,orders,disputes,payouts,compliance,reports}
    api/          # route handlers (checkout, webhooks/btcpay, applications, reports)
    sitemap.ts, robots.ts
  components/     # ui primitives (shadcn-style) + marketplace components
  lib/
    types.ts          # domain model (mirrors SQL schema)
    data.ts           # data access — Supabase when configured, seed catalog fallback
    seed.ts           # deterministic demo catalog for local dev / preview
    jurisdiction.ts   # checkout-eligibility rules engine
    health-score.ts   # Listing Health Score
    ranking.ts        # search ranking composition
    badges.ts         # badge derivation from verified facts only
    moderation.ts     # off-platform contact detectors
    schema-org.ts     # JSON-LD builders
    payments/         # PaymentProvider port + BTCPayAdapter
    shipping/         # ShippingProvider port + adapter stubs
supabase/
  migrations/       # full SQL schema + RLS
  seed.sql
cloudflare/
  marketplace-router.js   # Worker proxying /marketplace* → Vercel
docs/               # this documentation set
```

## 4. Data-layer strategy

`lib/data.ts` is the single read API used by pages. When
`NEXT_PUBLIC_SUPABASE_URL` is set it queries Supabase; otherwise it serves the
deterministic seed catalog so the full UI is reviewable locally and in Vercel
previews without secrets. Mutating flows (applications, checkout) hit route
handlers that require real backends — nothing mutates the seed data and no
payment is ever faked.

## 5. Environments

| Env | Data | Payments | Purpose |
|---|---|---|---|
| local / preview | seed catalog (read-only) | disabled state | UI/UX, SEO markup review |
| staging | Supabase staging project | BTCPay testnet/regtest | end-to-end flows |
| production | Supabase prod (PITR on) | BTCPay mainnet + LN | live |

## 6. Scale path

- Postgres: partition `audit_logs`, `tracking_events`, `payment_ledger` by month when volume demands; read replicas for analytics.
- Search: index rebuild worker on product/compliance mutations (Supabase webhooks → queue → Meilisearch).
- Later phases: extract commerce service (Medusa-compatible boundaries already exist in `lib/payments` + order state machines) if the modular monolith outgrows Vercel functions.
