# Permission Matrix, Route Map & API Design

## User-role permission matrix

| Capability | Anon | Buyer | Vendor | Admin |
|---|---|---|---|---|
| Browse live catalog / stores / reviews | ✅ (age-gated for cannabinoid categories) | ✅ | ✅ | ✅ |
| Place order (single-vendor cart, BTC/LN) | — | ✅ if destination eligible | ✅ (as buyer) | ✅ |
| Leave review | — | ✅ delivered orders only, once | — | — |
| Edit/delete reviews | — | ❌ (edit own within 30d, never delete) | ❌ **never** | moderate-only (abuse/spam/illegal), reason logged |
| Apply to sell | — | ✅ (upgrades to vendor on approval) | n/a | approve/reject/request-info |
| Create draft products | — | — | ✅ | ✅ |
| Publish products | — | — | ❌ **never** | ✅ (approve → live) |
| Upload COA / compliance data | — | — | ✅ (own, pending verification) | verify/reject |
| See raw Listing Health Score | — | — | ❌ (sees improvement hints) | ✅ |
| Message counterparty | — | ✅ on-platform only | ✅ on-platform only | ✅ + full visibility |
| Edit/delete messages | ❌ | ❌ | ❌ | ❌ (immutable; admin annotates) |
| Mark order shipped | — | — | only via platform label + acceptance scan | override w/ audit |
| Open dispute | — | ✅ ≤48h post-delivery | respond ≤48h | decide, refund, penalize |
| See payouts/reserves | — | — | own only | all + approve/hold |
| Adjust commissions, jurisdictions, badges, featured/sponsored | — | — | ❌ | ✅ |
| Suspend sellers / freeze payouts / hide products | — | — | — | ✅ (audited) |
| Off-platform contact exchange | ❌ | ❌ | ❌ (detected → flagged → enforcement) | n/a |

Enforced in three layers: RLS policies (data), route-handler guards (`lib/auth.ts`), UI gating (least important).

## Route map (public path = `/marketplace` + route below; app uses basePath)

| Route | Render | Auth | Purpose |
|---|---|---|---|
| `/` | ISR 10m | anon | homepage |
| `/categories/[slug]` | ISR 10m | anon | category grid + filters + SEO |
| `/product/[slug]` | ISR 5m | anon | product detail |
| `/store/[brand-slug]` | ISR 10m | anon | vendor storefront |
| `/search` | SSR | anon | Meilisearch-backed search |
| `/vendors/apply` | client | any (acct required to submit) | 6-step onboarding, autosave |
| `/vendor-dashboard(/products|orders|compliance|payouts|messages|wholesale)` | dynamic | vendor | seller ops |
| `/account`, `/orders`, `/orders/[id]`, `/messages`, `/disputes` | dynamic | buyer | buyer ops |
| `/admin(/vendors|products|orders|disputes|payouts|compliance|reports)` | dynamic | admin | ops console |
| `/legal/*` | static | anon | policies (vendor agreement, disputes, shipping, reviews) |
| `/sitemap.xml`, `/sitemap-products.xml`, `/sitemap-stores.xml`, `/sitemap-categories.xml`, `/robots.txt` | edge | anon | SEO |

## API design (route handlers under `/api`)

Conventions: JSON, zod-validated input, typed error envelope
`{ error: { code, message } }`, idempotency keys on mutation endpoints,
service-role operations never exposed client-side.

### Public / buyer
- `GET  /api/products?category&filters…` — catalog query (mirrors search facets)
- `POST /api/carts/{vendorId}/items` — add to vendor-scoped cart
- `POST /api/checkout` — validates jurisdiction eligibility server-side → creates order (pending_payment) → creates BTCPay invoice → returns invoice checkout link. **503 with clear message when BTCPay isn't configured — never a fake success.**
- `POST /api/orders/{id}/disputes` — open dispute (48h window enforced)
- `POST /api/orders/{id}/review` — verified review
- `POST /api/report-listing` — public "report listing issue"

### Vendor
- `POST /api/vendor/applications` — step upsert (autosave) + submit
- `POST /api/vendor/products` — create/update draft (server forces status ≤ pending_review)
- `POST /api/vendor/products/{id}/compliance` — structured COA record + file hash
- `POST /api/vendor/orders/{id}/label` — request platform label (shipping adapter)
- `POST /api/vendor/messages` — send (runs moderation detectors pre-persist)

### Admin
- `POST /api/admin/applications/{id}/decision` — approve/reject/request-info (reason codes)
- `POST /api/admin/products/{id}/review` — approve / reject / request changes
- `POST /api/admin/compliance/{id}/verify` — verify COA
- `POST /api/admin/disputes/{id}/decision` — refund full/partial/deny/return-required
- `POST /api/admin/payouts/{id}` — approve/hold/mark-sent (txid)
- `POST /api/admin/vendors/{id}` — suspend, reserve change, commission change

### Webhooks
- `POST /api/webhooks/btcpay` — HMAC-SHA256 verified (`BTCPay-Sig`); handles InvoiceSettled / InvoiceExpired / InvoiceInvalid / Processing; under/overpayment deltas recorded; idempotent by event id.
- `POST /api/webhooks/tracking` — carrier adapter events → `tracking_events` (validated), order state transitions.

## State machines (authoritative summary — details in 04-flows.md)

- **Application:** `draft → submitted → under_review → (info_requested ⇄ resubmitted) → approved | rejected(reason_code)`
- **Product:** `draft → pending_review → (changes_requested → draft) → approved → live ⇄ suspended → delisted`
- **Compliance record:** `submitted → verified | rejected`; `verified → expiring_soon → expired` (time-driven; expired kills badges + sponsored eligibility)
- **Order:** `pending_payment → paid → accepted → label_created → shipped(acceptance scan) → delivered → completed` (+ `cancelled`, `refunded`, `partially_refunded`; `expired_payment`)
- **Payment:** `invoice_created → processing → settled | expired | invalid`; `settled_underpaid / settled_overpaid` handled via ledger adjustments + support flow
- **Dispute:** `open → awaiting_buyer_evidence | awaiting_seller_response → under_admin_review → partial_refund_proposed | refund_approved | refund_denied | return_required → resolved → closed` (+ `seller_penalty`, `payout_held` side-effects)
- **Payout:** `accruing → eligible → queued → approved → sent | failed` (+ `held`)
- **Review:** `requested → submitted → published → (moderated)`
