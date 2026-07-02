# Operational Flows

## 1. Vendor onboarding

```
Create account → Step 1 identity/company basics → Step 2 business verification
(EIN, registration, owner ID, licenses, insurance, wallet ownership) →
Step 3 store profile → Step 4 compliance setup (categories, cannabinoids,
restricted jurisdictions, batch/COA process, policy acknowledgements) →
Step 5 product upload (manual / CSV / Shopify / Woo — all land as drafts) →
Step 6 submit → admin review queue
```

- Every step autosaves (`vendor_applications.steps jsonb`, one key per step).
- Admin can request info: application flips to `info_requested`, applicant sees
  missing-requirements checklist + threaded Q&A, resubmits.
- Approval: creates `vendors` row, flips profile role to `vendor`, storefront
  slug reserved, reserve tier assigned by risk rules (new vendor default:
  15% rolling 30 days; high-risk categories 25%/45d; reduced by performance).
- Rejection: reason codes (`incomplete_docs`, `unverifiable_identity`,
  `prohibited_products`, `jurisdiction`, `fraud_signals`, `other`) + resubmit path.
- Onboarding is free at launch. A post-approval verification fee (crypto) can be
  enabled later via `platform_settings.onboarding_fee` — charged only after
  approval, never before verification.

## 2. Product approval

```
vendor saves draft → submits → pending_review →
admin checklist: required fields ✓, images ✓, structured COA present ✓,
cannabinoid values vs category rules ✓, restricted jurisdictions sane ✓ →
approve → live      | request changes (field-level notes) → draft
                    | reject (reason) → delisted
```
Any post-approval edit to compliance-relevant fields (potency values, COA,
batch, category, jurisdiction list) reverts the product to `pending_review`;
cosmetic edits (description, images) go live but are audit-logged.

## 3. Compliance / COA review

```
vendor uploads COA file → server computes sha256 → structured entry
(lab, dates, potency results, safety panels) → admin compliance queue →
reviewer cross-checks file vs structured data (+lab site) → verified
→ badges become eligible (Verified COA, Batch Linked, Recently Tested)
```
Time-driven jobs: `retest_date - 30d` → `expiring_soon` (vendor notified);
past retest date → `expired` → badges removed, sponsored eligibility revoked,
listing health penalized, product flagged for re-review.

## 4. BTC payment flow

```
buyer cart (single vendor) → POST /api/checkout
  → server re-validates: stock, live status, jurisdiction eligibility(destination)
  → order created (pending_payment, totals + commission snapshot)
  → BTCPay Greenfield: create invoice (orderId metadata, 15 min expiry,
    speed policy per amount tier) → buyer pays on-chain or LN
webhook (HMAC verified, idempotent):
  InvoiceProcessing → order.payment_processing
  InvoiceSettled    → order.paid; ledger: buyer_payment, platform_commission,
                      vendor_earnings, reserve_hold
  InvoiceExpired    → order.expired_payment (stock released)
  InvoiceInvalid    → flagged for admin
underpayment → invoice marked, order stays unpaid, support flow (top-up or refund)
overpayment  → delta recorded in ledger, refundable on request
```
Public copy never calls this escrow. Adapter interface `PaymentProvider`
(`lib/payments/`) keeps BTCPay swappable/extensible.

## 5. Shipping flow

```
order.paid → vendor accepts → selects approved carrier/service
→ platform generates label (shipping adapter), cost recorded, origin verified
→ label linked to order — vendor CANNOT enter arbitrary tracking
→ carrier acceptance scan (webhook) → order.shipped, timeline visible to buyer
→ delivery scan → order.delivered → 48h dispute window opens
→ window closes clean → order.completed → payout accrual eligible
late-shipment: handling-time SLA exceeded → warning → repeated → health penalty
→ severe (X days, configurable) → auto-cancel eligibility + refund
```

## 6. Dispute flow

Defaults: buyer 48h post-delivery to open; seller 48h to respond; admin final.

```
open → (evidence requests both ways) → under_admin_review →
  refund_approved (full) | partial_refund_proposed → accepted/decided |
  refund_denied | return_required (label issued; refund on return scan)
side-effects: payout hold on open; seller_penalty & risk-score bump on fault;
repeated fault → reserve increase / suspension review
```
Eligible: damaged, wrong item, materially different, missing items, verified
shipment failure. Ineligible: changed mind, subjective taste/effect, unread
listing details, used consumables. Encoded as reason codes at intake — ineligible
reasons cannot be submitted (buyer sees policy explanation + support option).

## 7. Review flow

```
order.completed → review request (email + account notification)
→ buyer rates product + vendor separately
  (accuracy, packaging, shipping speed, communication, overall) + photos
→ published with Verified Purchase badge → feeds listing health + storefront
  aggregates + Review/AggregateRating schema
moderation: admin-only, limited to abuse/spam/illegal/threats/doxxing/fraud,
reason stored, review hidden not deleted
```

## 8. Payout flow

```
order.completed → ledger vendor_earnings become eligible per reserve schedule
→ nightly job assembles payout queue (eligible − holds − reserve)
→ admin reviews queue (wallet verified ✓, no fraud flags ✓)
→ approve → BTC/LN send (manual at launch, txid recorded) → sent
CSV export, full history, audit log on every action.
Holds: open dispute, compliance issue, suspicious activity, non-shipment,
tracking anomalies, policy violation.
```

## 9. Fraud-control model

Signals → `fraud_flags` (typed, weighted) → `risk_scores` (vendor + buyer) → actions.

| Signal | Source | Default action |
|---|---|---|
| Identity/doc mismatch | onboarding review | block approval |
| Wallet reuse across accounts | wallet registry | flag + manual review |
| Duplicate account fingerprints | signup heuristics | flag |
| Off-platform contact in messages | moderation detectors | warn → strike → suspend |
| Tracking without acceptance scan | shipping validation | block "shipped", flag |
| Repeated tracking failures | tracking stats | payout hold + review |
| Dispute rate > threshold | rolling 30/90d | reserve increase, sponsored revoked |
| Sudden price swings / inventory anomalies | catalog diffs | quality-review priority |
| Review burst / same-buyer patterns | review analytics | review-manipulation alert |
| Underpaid invoices pattern (buyer) | payments | buyer risk bump |

Admin risk dashboard = queue sorted by composite score; every action audited.
