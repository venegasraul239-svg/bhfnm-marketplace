# BUILD_STATUS — BHFNM Marketplace

Last updated: 2026-07-04 (beta milestone: demo → truthful, testable beta)

## Root causes found (vs the observed problems)

| Observed problem | Actual root cause |
|---|---|
| `applicant_id` null-constraint violation | `api/vendor/applications` hardcoded `applicant_id: null` — **no auth existed anywhere in the app** (no login pages, no session handling, no profiles lifecycle). Phase 1 had built UI + schema, not identity. |
| Dead cart/checkout/business-profile buttons | Static `<Button>` elements with no handlers; checkout API existed but nothing called it. |
| Demo data shown as real everywhere | `lib/data.ts` always served the seed catalog (explicit phase-1 TODO); vendor/admin dashboards had hardcoded demo rows. |
| Broken product images | Seed used remote Unsplash URLs with no fallback. |
| Email not configured | Correct — no email layer existed. |

Also fixed though unreported: checkout wrote `vendorSlug` (string) into the
`orders.vendor_id` uuid column and `buyer_id: null` — it could never have
inserted an order against the real schema; middleware canonical-host redirect
dropped the `/marketplace` basePath.

## Auth model (new)

- Supabase Auth, email+password, **email confirmation OFF for beta** (Supabase
  dashboard → Auth → Sign In / Up → disable "Confirm email").
- Founding admin: `webadmin@buyhempflowernearme.com` — auto-promoted on
  first sign-in (also configurable via `MARKETPLACE_ADMIN_EMAILS`).
- Profiles are created idempotently server-side (service-role self-heal) and by
  the `auth.users` trigger in migration 0003. New accounts default to `buyer`.
- Identity/role is always derived server-side from the cookie session
  (`src/lib/auth.ts`); no client payload is ever trusted for id or role.

## Routes now protected (middleware session gate + server-side role guards + RLS)

- `/admin`, `/admin/*` — admin only (`requireRole("admin")` in layout)
- `/vendor-dashboard`, `/vendor-dashboard/*` — vendor or admin
- `/account`, `/orders`, `/orders/*`, `/messages`, `/disputes`, `/cart` — session required
- Privileged APIs: `api/admin/*` (admin), `api/vendor/*` (vendor/admin + own-store
  scoping), `api/cart`, `api/checkout`, `api/account/*` (session), webhook (HMAC).

## Truthfulness guard

`lib/data.ts` `dataMode()`:
- **live** — Supabase configured: only `live` products of `active` vendors,
  `published` reviews, `verified` COAs; badges derived from records; metrics
  render only when measured.
- **demo** — ONLY `NEXT_PUBLIC_DEMO_MODE=true` on a non-production deploy, or
  local dev without Supabase. Demo products are explicitly non-purchasable.
- **empty** — production without Supabase: truthful empty states.
Production with Supabase can never serve seed data.

## Functional flows now implemented

1. Sign-up / sign-in / sign-out; idempotent profile creation; admin bootstrap.
2. Vendor application: authenticated autosave + submit → status page with
   reason codes, missing sections, admin Q&A thread.
3. Admin vendor review: approve (provisions store, unique slug, reserve tier
   15%/30d or 25%/45d high-risk, promotes role), reject (reason codes),
   request-info (creates applicant-visible thread message). All audited.
4. Vendor products: draft create/edit (own, draft/changes_requested only),
   structured COA data required for cannabinoid listings, submit → pending_review.
5. Admin product review: approve→live / reject / request-changes with
   vendor-visible notes; batch-mismatch warnings. Admin COA verification queue
   (verification unlocks public badges).
6. Public catalog: live Supabase data with SEO structure intact; launch/empty
   states; SafeImage fallback.
7. Wholesale buyer profile: real form → own `wholesale_profiles` row only.
8. Cart: one per buyer×vendor (server-resolved), persistent, quantity/remove.
9. Checkout: session buyer + server cart truth → revalidates live/stock/
   jurisdiction per line → pending-payment order + order_items + **real BTCPay
   invoice** → redirect to invoice; idempotency-key dedupe; invoice failure
   rolls the order back with a clear message.
10. BTCPay webhook: HMAC (timing-safe) verified, event-id idempotent, maps
    Processing/Settled(+under/over-paid)/Expired/Invalid → payment + order
    states; settlement posts the atomic ledger RPC and fires notification
    emails (no-op until provider configured).
11. Email abstraction (`lib/email.ts`): Resend adapter; structured console
    no-op without `RESEND_API_KEY`/`EMAIL_FROM`; events wired for application
    lifecycle, product decisions, payment received.

## Intentionally unavailable (explicit beta notes in UI, not dead buttons)

- Shipping label generation / tracking timeline (carrier integration milestone)
- Dispute intake + admin dispute decisions (requires fulfillment first)
- Messaging send/reply UI (threads render read-only; moderation detectors exist in `lib/moderation.ts`)
- Wholesale access approve/deny controls; COA file upload to storage
  (structured data flows now; files land with the storage pipeline)
- Payout queue execution (manual BTC send; UI shows real accruals)

## Operator setup still required (one-time)

1. **Apply `supabase/migrations/0003_auth_and_settlement.sql`** in the Supabase
   SQL editor (profiles trigger, settlement ledger RPC, idempotency key,
   one-active-application index). The app self-heals without it, but the
   ledger RPC and checkout idempotency need it.
2. Supabase Auth: disable email confirmation (beta), set Site URL to
   `https://buyhempflowernearme.com/marketplace`.
3. When ready for email: set `RESEND_API_KEY`, `EMAIL_FROM`,
   `ADMIN_NOTIFICATION_EMAILS` in Vercel (blank = no sending, by design).

## Exact beta test sequence

1. Sign up as `webadmin@buyhempflowernearme.com` → `/account` shows role admin;
   `/admin` loads; anonymous/incognito `/admin` redirects to sign-in.
2. Sign up a second account (vendor-to-be). `/vendors/apply` → complete steps
   (banner confirms signed-in autosave) → submit → lands on
   `/vendors/apply/status` as “Submitted”.
3. As admin → `/admin/vendors` → the application appears with real data →
   Request information → applicant status page shows the message; resubmit;
   → Approve → storefront provisioned, applicant role becomes vendor.
4. As vendor → `/vendor-dashboard/products` → create draft with COA data →
   Submit for review. Verify `/marketplace/product/...` is NOT public yet.
5. As admin → `/admin/products` → approve → product live on category/store/
   search pages with real price/stock; `/admin/compliance` → verify the COA →
   Verified COA badge appears on the product page.
6. As a third (buyer) account: product page → Add to cart → `/cart` → pick
   destination (try a restricted lane to see the denial, e.g. cross-border) →
   Checkout with BTC → real BTCPay invoice opens → pay on staging/regtest →
   webhook flips order to `paid` → visible in `/orders/[id]` and both
   dashboards; ledger entries appear in `/vendor-dashboard/payouts`.
7. Webhook negative test: POST junk with a bad `BTCPay-Sig` to
   `/marketplace/api/webhooks/btcpay` → 401; redeliver a settled event from
   BTCPay → “duplicate delivery ignored”.
8. `/account` → Set up business profile → save → persists on reload (and only
   for that account).

## Commits in this milestone

- `da6ddfe` auth: sessions, profiles, role guards, admin bootstrap
- `eb2ce83` truthful data layer, demo lock-out, empty states, SafeImage
- `186cb06` vendor application fix + status page + email abstraction
- `23fbac6` admin vendor review (approve/provision/reject/request-info)
- `5b6693d` product workflow + de-faked vendor/admin dashboards
- `069054d` cart + BTC checkout wiring, wholesale profile, buyer pages
- (this commit) BUILD_STATUS.md + validation fixes
