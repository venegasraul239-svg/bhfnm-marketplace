# BHFNM Marketplace

Compliance-first, multi-vendor hemp marketplace for
[buyhempflowernearme.com/marketplace](https://buyhempflowernearme.com/marketplace).

Next.js 15 (App Router, `basePath=/marketplace`) · TypeScript · Tailwind v4 ·
Supabase (Postgres + RLS + Auth + Storage) · self-hosted BTCPay (BTC + Lightning) ·
Meilisearch · Cloudflare Worker path-routing over the existing WordPress site.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000/marketplace (seed catalog, no secrets needed)
pnpm build        # production build
```

Without env config the app serves a **read-only seed catalog** so every surface
is reviewable. Checkout and application intake return honest 503s — **no
payment or approval is ever simulated**. Copy `.env.example` → `.env.local` to
wire Supabase/BTCPay.

## Repository map

| Path | What |
|---|---|
| `docs/` | Architecture, DB schema/ERD, permissions, flows, SEO, deployment, roadmap, wireframes |
| `supabase/migrations/` | Full Postgres schema (44 tables) + RLS policies |
| `supabase/seed.sql` | Categories + jurisdiction defaults |
| `cloudflare/` | Worker that routes `/marketplace*` → Vercel (WordPress untouched) |
| `src/lib/` | Domain types, jurisdiction rules engine, listing health score, ranking, moderation detectors, payment/shipping ports, schema.org builders |
| `src/app/` | Public pages, vendor onboarding + dashboard, buyer account, admin console, API routes |

## Non-negotiable invariants

1. One order = one vendor (no mixed carts)
2. Products never publish without admin review (RLS-enforced)
3. Sellers can never touch reviews or messages (no grants exist)
4. "Shipped" requires a platform label + carrier acceptance scan
5. COAs are structured, hash-verified records — not attachments
6. Payouts wait for delivery + dispute window; rolling reserves for new sellers
7. Sponsored listings are trust-gated and always labeled
8. Restricted destinations get notices, never de-indexed pages
9. No legal-compliance claims — verification status only; "escrow" never used publicly

## Deployment (summary — full detail in docs/06-deployment.md)

1. Deploy to Vercel (don't attach the apex domain).
2. `wrangler deploy` the Worker with route `buyhempflowernearme.com/marketplace*`.
3. `supabase db push` + seed; configure BTCPay store + webhook.
4. Submit `/marketplace/sitemap.xml` to GSC; add sitemap line to root robots.txt.
Rollback = remove the Worker route.
