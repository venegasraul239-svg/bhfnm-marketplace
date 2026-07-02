-- BHFNM Marketplace — core schema
-- 0001_init.sql: extensions, enums, tables, indexes, triggers

create extension if not exists "pgcrypto";

-- ============================================================ enums
create type user_role as enum ('buyer','vendor','admin');
create type seller_type as enum (
  'hemp_farm','manufacturer','cbd_brand','cbg_brand','thca_brand',
  'hd_cannabinoid_brand','beverage_brand','wellness_brand','accessory_retailer',
  'distributor','wholesaler','retail_store','private_label','dropshipper','reseller');
create type application_status as enum
  ('draft','submitted','under_review','info_requested','resubmitted','approved','rejected');
create type application_reason_code as enum
  ('incomplete_docs','unverifiable_identity','prohibited_products','jurisdiction','fraud_signals','other');
create type product_status as enum
  ('draft','pending_review','changes_requested','approved','live','suspended','delisted');
create type cannabinoid_type as enum
  ('cbd','cbg','cbn','thca','delta9_hemp','delta8','hhc','mixed','none');
create type compliance_status as enum ('submitted','verified','rejected','expiring_soon','expired');
create type panel_result as enum ('pass','fail','not_tested','pending');
create type order_status as enum
  ('pending_payment','payment_processing','expired_payment','paid','accepted',
   'label_created','shipped','delivered','completed','cancelled','refunded','partially_refunded');
create type payment_status as enum
  ('invoice_created','processing','settled','settled_underpaid','settled_overpaid','expired','invalid');
create type payment_method as enum ('btc_onchain','lightning');
create type ledger_entry_type as enum
  ('buyer_payment','platform_commission','vendor_earnings','reserve_hold',
   'reserve_release','refund','payout','adjustment','label_cost','sponsored_fee');
create type shipment_status as enum
  ('label_created','acceptance_scanned','in_transit','out_for_delivery',
   'delivered','delivery_failed','returned','lost');
create type dispute_status as enum
  ('open','awaiting_buyer_evidence','awaiting_seller_response','under_admin_review',
   'partial_refund_proposed','refund_approved','refund_denied','return_required','resolved','closed');
create type dispute_reason as enum
  ('damaged','wrong_product','materially_different','missing_items','shipment_failure');
create type payout_status as enum ('queued','approved','sent','failed','held');
create type review_status as enum ('published','moderated');
create type thread_type as enum ('order','product_inquiry','application','support');
create type message_sender_role as enum ('buyer','vendor','admin','system');
create type flag_type as enum
  ('email_address','phone_number','wallet_address','telegram','whatsapp','discord',
   'external_url','offplatform_payment','duplicate_account','tracking_anomaly',
   'price_swing','inventory_anomaly','dispute_rate','review_manipulation',
   'underpayment_pattern','wallet_reuse','other');
create type jurisdiction_effect as enum ('allow','deny','notice_only');
create type doc_type as enum
  ('business_registration','ein_tax','government_id','license','insurance',
   'wallet_ownership','coa_process','other');
create type doc_review_status as enum ('pending','accepted','rejected');
create type badge_key as enum
  ('identity_verified_seller','verified_coa','batch_linked_coa','recently_tested',
   'marketplace_shipping_tracking','top_rated_seller','wholesale_capable',
   'private_label_capable','manufacturer_direct','farm_direct','verified_brand');

-- ============================================================ identity
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'buyer',
  display_name text,
  phone text,
  country char(2),
  region text,                       -- state/province code
  dob_verified_at timestamptz,       -- age-gate DOB confirmation
  risk_tier smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table vendor_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references profiles(id) on delete cascade,
  status application_status not null default 'draft',
  reason_code application_reason_code,
  reason_note text,
  steps jsonb not null default '{}'::jsonb,   -- {account, business, store, compliance, products}
  current_step smallint not null default 1,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on vendor_applications (status, submitted_at);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  application_id uuid references vendor_applications(id),
  slug text not null unique,
  brand_name text not null,
  seller_type seller_type not null,
  legal_business_name text,
  dba_name text,
  tax_id_last4 text,
  country char(2) not null,
  region text,
  operating_address jsonb,
  shipping_origin jsonb,             -- {country, region, city, zip}
  logo_url text,
  cover_url text,
  about text,
  brand_story text,
  seo_description text,
  support_email text,
  support_phone text,
  support_hours text,
  website text,
  social_links jsonb default '{}'::jsonb,
  wholesale_enabled boolean not null default false,
  private_label_enabled boolean not null default false,
  min_order_quantity int,
  identity_verified boolean not null default false,
  business_verified boolean not null default false,
  wallet_verified boolean not null default false,
  payout_wallet text,                -- BTC/LN destination (verified)
  handling_days_min smallint not null default 1,
  handling_days_max smallint not null default 3,
  return_policy text,
  policies jsonb default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  suspended_reason text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on vendors (status);

create table vendor_documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) on delete cascade,
  application_id uuid references vendor_applications(id) on delete cascade,
  doc_type doc_type not null,
  storage_path text not null,        -- private bucket
  file_hash text,
  review_status doc_review_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================ catalog
create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_id uuid references categories(id),
  description text,
  seo_intro text,
  age_restricted boolean not null default true,
  jurisdiction_sensitive boolean not null default true,  -- participates in rules engine
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  category_id uuid not null references categories(id),
  slug text not null unique,
  title text not null,
  subtype text,
  description text,
  short_description text,
  status product_status not null default 'draft',
  status_note text,                   -- admin change-request notes
  cannabinoid_type cannabinoid_type not null default 'none',
  batch_number text,
  manufacturing_date date,
  expiry_or_retest_date date,
  country_of_origin char(2),
  manufacturing_region text,
  shipping_origin jsonb,
  handling_days_min smallint,
  handling_days_max smallint,
  restricted_jurisdictions jsonb not null default '[]'::jsonb, -- [{country, region}]
  packaging_warning_confirmed boolean not null default false,
  age_restricted boolean not null default true,
  compliance_notes text,
  wholesale_available boolean not null default false,
  wholesale_moq int,
  private_label_available boolean not null default false,
  featured_eligible boolean not null default false,
  sponsored_eligible boolean not null default false,     -- derived by trust gates
  search_facts jsonb default '{}'::jsonb,                -- AI-readable fact block
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on products (status, category_id);
create index on products (vendor_id, status);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null,
  name text not null,                  -- e.g. "3.5g", "1oz"
  price_cents int not null check (price_cents >= 0),
  compare_at_cents int,
  currency char(3) not null default 'USD',
  stock int not null default 0,
  weight_grams numeric,
  dimensions jsonb,
  wholesale_only boolean not null default false,
  unique (product_id, sku)
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  alt text,
  sort int not null default 0
);

create table wholesale_price_tiers (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants(id) on delete cascade,
  min_quantity int not null,
  price_cents int not null
);

-- ============================================================ compliance
create table compliance_records (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  batch_number text not null,
  coa_storage_path text not null,
  coa_file_hash text not null,           -- sha256, verified at upload
  lab_name text not null,
  lab_website text,
  coa_issue_date date not null,
  retest_date date,
  delta9_thc_pct numeric,
  total_thc_pct numeric,
  thca_pct numeric,
  cbd_pct numeric,
  cbg_pct numeric,
  other_cannabinoids jsonb default '{}'::jsonb,
  pesticides panel_result not null default 'not_tested',
  heavy_metals panel_result not null default 'not_tested',
  microbials panel_result not null default 'not_tested',
  residual_solvents panel_result not null default 'not_tested',
  foreign_material panel_result not null default 'not_tested',
  result_notes text,
  admin_notes text,
  status compliance_status not null default 'submitted',
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  badge_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on compliance_records (status, retest_date);
create index on compliance_records (product_id);

create table compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references compliance_records(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  action text not null,                 -- verified | rejected | note
  notes text,
  created_at timestamptz not null default now()
);

create table vendor_badges (
  vendor_id uuid not null references vendors(id) on delete cascade,
  badge badge_key not null,
  granted_at timestamptz not null default now(),
  granted_reason text,
  primary key (vendor_id, badge)
);

create table listing_health (
  product_id uuid primary key references products(id) on delete cascade,
  score numeric not null default 0,      -- 0..100, internal only
  components jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

-- ============================================================ commerce
create table carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, vendor_id)            -- one cart per vendor: no mixed checkout
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id),
  quantity int not null check (quantity > 0),
  unique (cart_id, variant_id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  buyer_id uuid not null references profiles(id),
  vendor_id uuid not null references vendors(id),
  status order_status not null default 'pending_payment',
  subtotal_cents int not null,
  shipping_cents int not null default 0,
  total_cents int not null,
  currency char(3) not null default 'USD',
  commission_rate numeric not null,        -- snapshot at order time
  commission_cents int not null,
  destination jsonb not null,              -- {country, region, city, zip} — validated by rules engine
  eligibility_snapshot jsonb,              -- rules-engine decision recorded
  handling_deadline timestamptz,
  delivered_at timestamptz,
  dispute_window_ends_at timestamptz,
  completed_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (vendor_id, status);
create index on orders (buyer_id, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  variant_id uuid not null references product_variants(id),
  compliance_record_id uuid references compliance_records(id), -- COA snapshot at purchase
  title text not null,
  variant_name text not null,
  quantity int not null,
  unit_price_cents int not null
);

create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  actor_id uuid references profiles(id),
  from_status order_status,
  to_status order_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null default 'btcpay',
  invoice_id text not null unique,
  checkout_link text,
  method payment_method,
  status payment_status not null default 'invoice_created',
  amount_fiat_cents int not null,
  amount_btc numeric,
  amount_received_btc numeric,
  underpaid_delta_btc numeric,
  overpaid_delta_btc numeric,
  expires_at timestamptz,
  settled_at timestamptz,
  raw_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table payment_ledger (
  id bigint generated always as identity primary key,
  order_id uuid references orders(id),
  vendor_id uuid references vendors(id),
  payout_id uuid,
  entry_type ledger_entry_type not null,
  amount_cents int not null,               -- signed
  amount_btc numeric,
  memo text,
  created_at timestamptz not null default now()
);
create index on payment_ledger (vendor_id, entry_type, created_at);

create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('platform','category','vendor','product','wholesale')),
  category_id uuid references categories(id),
  vendor_id uuid references vendors(id),
  product_id uuid references products(id),
  rate numeric not null check (rate >= 0 and rate <= 0.5),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================ fulfillment
create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  carrier text not null,
  service text not null,
  tracking_number text not null,
  label_storage_path text,
  label_cost_cents int,
  origin_verified boolean not null default false,
  status shipment_status not null default 'label_created',
  acceptance_scanned_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on shipments (order_id);

create table tracking_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references shipments(id) on delete cascade,
  carrier_event_id text,
  event_code text not null,
  description text,
  location text,
  occurred_at timestamptz not null,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (shipment_id, carrier_event_id)
);

-- ============================================================ payouts & risk
create table vendor_reserves (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  reserve_pct numeric not null default 0.15,
  rolling_days int not null default 30,
  risk_tier smallint not null default 1,
  notes text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id),
  amount_cents int not null,
  amount_btc numeric,
  wallet_address text not null,
  status payout_status not null default 'queued',
  txid text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  sent_at timestamptz,
  failure_reason text,
  admin_notes text,
  created_at timestamptz not null default now()
);
create index on payouts (vendor_id, status);

create table payout_items (
  payout_id uuid not null references payouts(id) on delete cascade,
  order_id uuid not null references orders(id),
  amount_cents int not null,
  primary key (payout_id, order_id)
);

create table payout_holds (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  order_id uuid references orders(id),
  reason text not null,
  created_by uuid references profiles(id),
  released_at timestamptz,
  released_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table fraud_flags (
  id uuid primary key default gen_random_uuid(),
  flag_type flag_type not null,
  severity smallint not null default 1 check (severity between 1 and 5),
  profile_id uuid references profiles(id),
  vendor_id uuid references vendors(id),
  order_id uuid references orders(id),
  message_id uuid,
  details jsonb,
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on fraud_flags (vendor_id, resolved_at);

create table risk_scores (
  subject_type text not null check (subject_type in ('vendor','buyer')),
  subject_id uuid not null,
  score numeric not null default 0,
  components jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (subject_type, subject_id)
);

-- ============================================================ trust & comms
create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) unique,   -- one review per order
  product_id uuid not null references products(id),
  vendor_id uuid not null references vendors(id),
  buyer_id uuid not null references profiles(id),
  rating_overall smallint not null check (rating_overall between 1 and 5),
  rating_accuracy smallint check (rating_accuracy between 1 and 5),
  rating_packaging smallint check (rating_packaging between 1 and 5),
  rating_shipping smallint check (rating_shipping between 1 and 5),
  rating_communication smallint check (rating_communication between 1 and 5),
  title text,
  body text,
  photo_urls jsonb default '[]'::jsonb,
  verified_purchase boolean not null default true,
  status review_status not null default 'published',
  moderated_reason text,               -- abuse|spam|illegal|threats|doxxing|fraud only
  moderated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on reviews (product_id, status);
create index on reviews (vendor_id, status);

create table message_threads (
  id uuid primary key default gen_random_uuid(),
  thread_type thread_type not null,
  order_id uuid references orders(id),
  product_id uuid references products(id),
  application_id uuid references vendor_applications(id),
  buyer_id uuid references profiles(id),
  vendor_id uuid references vendors(id),
  dispute_id uuid,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_id uuid references profiles(id),
  sender_role message_sender_role not null,
  body text not null,
  attachments jsonb default '[]'::jsonb,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
  -- immutable by policy: no update/delete grants (see 0002)
);
create index on messages (thread_id, created_at);

create table message_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  flag_type flag_type not null,
  matched_text text,
  reviewed_by uuid references profiles(id),
  action_taken text,
  created_at timestamptz not null default now()
);

create table internal_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  author_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  buyer_id uuid not null references profiles(id),
  vendor_id uuid not null references vendors(id),
  reason dispute_reason not null,
  description text not null,
  status dispute_status not null default 'open',
  refund_amount_cents int,
  decision_note text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  seller_response_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on disputes (status, created_at);

create table dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  evidence_type text not null,           -- photo|packaging|tracking|coa|message_ref|other
  storage_path text,
  note text,
  created_at timestamptz not null default now()
);

create table dispute_events (
  id bigint generated always as identity primary key,
  dispute_id uuid not null references disputes(id) on delete cascade,
  actor_id uuid references profiles(id),
  from_status dispute_status,
  to_status dispute_status not null,
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================ wholesale
create table wholesale_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  company_name text not null,
  business_type text,
  resale_certificate jsonb,             -- number/state/doc path
  tax_info jsonb,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table wholesale_access (
  vendor_id uuid not null references vendors(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','approved','denied','revoked')),
  decided_at timestamptz,
  primary key (vendor_id, buyer_id)
);

create table wholesale_inquiries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id),
  buyer_id uuid not null references profiles(id),
  product_id uuid references products(id),
  inquiry_type text not null default 'wholesale' check (inquiry_type in ('wholesale','private_label')),
  message text,
  status text not null default 'open',
  referral_source text,
  created_at timestamptz not null default now()
);

create table referral_attributions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id),
  vendor_id uuid not null references vendors(id),
  first_order_id uuid references orders(id),
  source text not null,
  commission_rule_id uuid references commission_rules(id),
  created_at timestamptz not null default now()
);

-- ============================================================ governance
create table jurisdiction_rules (
  id uuid primary key default gen_random_uuid(),
  country char(2) not null,
  region text,                            -- null = whole country
  category_id uuid references categories(id),   -- null = all categories
  cannabinoid cannabinoid_type,           -- null = all
  effect jurisdiction_effect not null,
  cross_border boolean not null default false,  -- rule applies to cross-border lane
  notice text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on jurisdiction_rules (country, region);

create table age_gate_policies (
  id uuid primary key default gen_random_uuid(),
  country char(2) not null,
  region text,
  category_class text not null default 'cannabinoid',
  min_age smallint not null default 21,
  created_at timestamptz not null default now()
);

create table sponsored_placements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  vendor_id uuid not null references vendors(id),
  placement text not null default 'search' check (placement in ('search','category','home')),
  fee_cents int not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table featured_placements (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('product','vendor','category')),
  entity_id uuid not null,
  surface text not null default 'home',
  sort int not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references profiles(id)
);

create table platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table listing_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  reporter_email text,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role user_role,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index on audit_logs (entity_type, entity_id);
create index on audit_logs (actor_id, created_at desc);

-- ============================================================ triggers
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','vendor_applications','vendors','products',
    'compliance_records','orders','carts','shipments','reviews','disputes']
  loop
    execute format('create trigger %I_updated_at before update on %I
      for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- order number generator: BH-YYMM-XXXXXX
create or replace function gen_order_number() returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'BH-' || to_char(now(),'YYMM') || '-' ||
      upper(substr(encode(gen_random_bytes(4),'hex'),1,6));
  end if;
  return new;
end $$;
create trigger orders_number before insert on orders
  for each row execute function gen_order_number();

-- audit trigger for sensitive tables
create or replace function write_audit() returns trigger language plpgsql security definer as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), TG_OP, TG_TABLE_NAME,
          coalesce((case when TG_OP='DELETE' then old.id::text else new.id::text end)),
          case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['products','compliance_records','vendors','payouts',
    'disputes','commission_rules','jurisdiction_rules','reviews','vendor_reserves',
    'payout_holds','sponsored_placements']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I
      for each row execute function write_audit()', t, t);
  end loop;
end $$;

-- platform defaults
insert into platform_settings (key, value) values
  ('default_commission', '{"rate": 0.12}'),
  ('dispute_windows', '{"buyer_report_hours": 48, "seller_response_hours": 48}'),
  ('new_vendor_reserve', '{"pct": 0.15, "rolling_days": 30}'),
  ('high_risk_reserve', '{"pct": 0.25, "rolling_days": 45}'),
  ('onboarding_fee', '{"enabled": false, "amount_cents": 0, "currency": "USD"}'),
  ('sponsored_rules', '{"max_per_page": 2, "trust_gated": true}');
