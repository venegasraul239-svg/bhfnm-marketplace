# Deployment: WordPress + Next.js on one domain

## Constraint recap (from audit)

- WordPress/Woo on Hostinger origin, LiteSpeed cache, hPanel.
- Cloudflare already proxies the apex (orange cloud) — this is the routing layer we exploit.
- `/marketplace` currently 404s at the origin — no collision.

## Chosen architecture: Cloudflare Worker path-router (safest)

```
Cloudflare route: buyhempflowernearme.com/marketplace*  →  Worker
Worker: proxy request to  <project>.vercel.app  (Host header preserved logic below)
All other paths: untouched → Hostinger origin (zero WordPress changes)
```

Why this beats alternatives:

| Option | Verdict |
|---|---|
| **CF Worker proxy to Vercel** ✅ | No DNS change, no WP change, instant rollback (disable route), per-path control, keeps LiteSpeed + CF caching for WP |
| Vercel as primary domain + rewrites to WP | Moves the whole domain's DNS to Vercel edge; risks WP cache/SSL/plugin quirks; big blast radius for an SEO-critical site |
| Nginx/LiteSpeed reverse proxy on Hostinger | Shared hosting: no server-level proxy control; fragile via .htaccess |
| Subdomain (market.buyhempflowernearme.com) | Splits domain authority; violates the /marketplace requirement |

## Worker (see `cloudflare/marketplace-router.js`)

- Matches `/marketplace` and `/marketplace/*` (plus `/marketplace/_next/*` assets — automatic since basePath prefixes assets).
- Forwards method/headers/body to `https://<prod-deployment>.vercel.app`, sets
  `X-Forwarded-Host: buyhempflowernearme.com` and a shared-secret header
  (`X-BHFNM-Proxy`) that the Next app can require in middleware to block direct
  vercel.app access (direct access also blocked by a
  `vercel.json` redirect + `<meta robots>` guard on non-canonical host to
  prevent duplicate indexing).
- Streams responses; passes through cache headers (Next ISR emits
  `s-maxage/stale-while-revalidate`; CF respects them).

## Vercel configuration

- Project root = this repo; framework preset Next.js; `basePath=/marketplace` already set.
- Env vars per environment (see `.env.example`); Supabase + BTCPay secrets in Vercel encrypted env.
- **Do not attach the apex domain to Vercel.** The Worker is the only public entry; the vercel.app URL stays as the Worker origin.
- Regions: `iad1` (Supabase region should match).
- Cron (later phases): COA expiry sweep, payout queue build, late-shipment scan — Vercel Cron hitting authenticated `/api/jobs/*` handlers.

## Rollout / rollback

1. Deploy app to Vercel (preview → prod), verify on vercel.app URL with `X-BHFNM-Proxy` bypass param.
2. Add Worker + route `buyhempflowernearme.com/marketplace*` (Cloudflare dashboard → Workers Routes).
3. Smoke test: `/marketplace`, deep product URL, `_next` assets, sitemap.
4. Submit `/marketplace/sitemap.xml` in GSC; add Sitemap line to root robots.txt via WP.
5. Rollback = delete the Worker route (origin 404 returns instantly; WP unaffected).

## WordPress-side tasks (only two, both reversible)

1. Root `robots.txt`: append marketplace sitemap line.
2. Add "Marketplace" item to the WP nav pointing at `/marketplace` (visual continuity; match header link styling).

## Supabase migration plan

```
supabase init && supabase link --project-ref <ref>
supabase db push            # applies supabase/migrations in order
psql $DATABASE_URL -f supabase/seed.sql   # staging only
```
Buckets: `product-images` (public), `brand-assets` (public), `coas`,
`vendor-documents`, `dispute-evidence`, `shipping-evidence` (all private,
signed-URL access, RLS storage policies by owner/admin). PITR enabled in prod.

## BTCPay integration plan

- Self-host BTCPay (Docker deployment on a VPS; LND for Lightning; Tor optional).
- Create store; Greenfield API key scoped to `btcpay.store.cancreateinvoice`,
  `btcpay.store.canviewinvoices`, `btcpay.store.webhooks.canmodifywebhooks`.
- Webhook → `https://buyhempflowernearme.com/marketplace/api/webhooks/btcpay`
  with secret = `BTCPAY_WEBHOOK_SECRET` (HMAC verified in the handler).
- Invoice creation: `POST /api/v1/stores/{storeId}/invoices` with
  `metadata.orderId`, `checkout.expirationMinutes: 15`,
  `speedPolicy: MediumSpeed` (on-chain) — implemented in
  `src/lib/payments/btcpay.ts`.
- Refunds: BTCPay pull-payments API, triggered from dispute decisions (Phase 3).
- Payouts: manual at launch from platform wallet; BTCPay payout API automation in Phase 5.
