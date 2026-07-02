-- 0002_rls_policies.sql — Row-Level Security: the permission matrix at the data layer

-- helpers -------------------------------------------------------------
create or replace function is_admin() returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function my_vendor_id() returns uuid language sql stable as $$
  select id from vendors where owner_id = auth.uid() limit 1;
$$;

-- enable RLS everywhere -----------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- profiles
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));
-- role changes only via service role / admin function

-- vendor applications
create policy va_own on vendor_applications for select using (applicant_id = auth.uid() or is_admin());
create policy va_insert on vendor_applications for insert with check (applicant_id = auth.uid());
create policy va_update_own on vendor_applications for update
  using (applicant_id = auth.uid() and status in ('draft','info_requested'))
  with check (applicant_id = auth.uid() and status in ('draft','submitted','resubmitted'));
create policy va_admin_update on vendor_applications for update using (is_admin());

-- vendors: public read of active stores; owner limited update (never verification flags)
create policy vendors_public_read on vendors for select using (status = 'active' or owner_id = auth.uid() or is_admin());
create policy vendors_owner_update on vendors for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
    and identity_verified = (select identity_verified from vendors v where v.id = vendors.id)
    and business_verified = (select business_verified from vendors v where v.id = vendors.id)
    and wallet_verified   = (select wallet_verified   from vendors v where v.id = vendors.id)
    and status            = (select status            from vendors v where v.id = vendors.id));
create policy vendors_admin_all on vendors for update using (is_admin());

-- vendor documents: owner + admin only
create policy vdocs_owner on vendor_documents for select
  using (is_admin() or vendor_id = my_vendor_id()
         or application_id in (select id from vendor_applications where applicant_id = auth.uid()));
create policy vdocs_insert on vendor_documents for insert
  with check (vendor_id = my_vendor_id()
         or application_id in (select id from vendor_applications where applicant_id = auth.uid()));

-- categories: public read, admin write
create policy categories_read on categories for select using (true);
create policy categories_admin on categories for all using (is_admin());

-- products: anon sees live only; vendor sees own; vendor can never self-publish
create policy products_public_read on products for select
  using (status = 'live' or vendor_id = my_vendor_id() or is_admin());
create policy products_vendor_insert on products for insert
  with check (vendor_id = my_vendor_id() and status in ('draft','pending_review'));
create policy products_vendor_update on products for update
  using (vendor_id = my_vendor_id() and status in ('draft','changes_requested','pending_review'))
  with check (vendor_id = my_vendor_id() and status in ('draft','pending_review'));
create policy products_admin on products for update using (is_admin());

create policy variants_read on product_variants for select using (
  exists (select 1 from products p where p.id = product_id
          and (p.status = 'live' or p.vendor_id = my_vendor_id() or is_admin())));
create policy variants_vendor_write on product_variants for all using (
  exists (select 1 from products p where p.id = product_id and p.vendor_id = my_vendor_id()
          and p.status in ('draft','changes_requested','pending_review')));
create policy images_read on product_images for select using (true);
create policy images_vendor_write on product_images for all using (
  exists (select 1 from products p where p.id = product_id and p.vendor_id = my_vendor_id()));
create policy tiers_read on wholesale_price_tiers for select using (true);
create policy tiers_vendor_write on wholesale_price_tiers for all using (
  exists (select 1 from product_variants v join products p on p.id = v.product_id
          where v.id = variant_id and p.vendor_id = my_vendor_id()));

-- compliance: public reads verified summaries of live products; vendor own; admin verifies
create policy cr_public_read on compliance_records for select using (
  status in ('verified','expiring_soon')
  and exists (select 1 from products p where p.id = product_id and p.status = 'live')
  or is_admin()
  or exists (select 1 from products p where p.id = product_id and p.vendor_id = my_vendor_id()));
create policy cr_vendor_insert on compliance_records for insert with check (
  exists (select 1 from products p where p.id = product_id and p.vendor_id = my_vendor_id()));
create policy cr_vendor_update on compliance_records for update using (
  status = 'submitted'
  and exists (select 1 from products p where p.id = product_id and p.vendor_id = my_vendor_id()))
  with check (status = 'submitted' and verified_by is null and badge_eligible = false);
create policy cr_admin on compliance_records for update using (is_admin());
create policy crev_admin on compliance_reviews for all using (is_admin());

create policy badges_read on vendor_badges for select using (true);
create policy badges_admin on vendor_badges for all using (is_admin());

-- listing health: internal only (vendor never sees raw score; admin + service role)
create policy lh_admin on listing_health for select using (is_admin());

-- carts
create policy carts_own on carts for all using (buyer_id = auth.uid());
create policy cart_items_own on cart_items for all using (
  exists (select 1 from carts c where c.id = cart_id and c.buyer_id = auth.uid()));

-- orders: buyer + fulfilling vendor + admin
create policy orders_read on orders for select
  using (buyer_id = auth.uid() or vendor_id = my_vendor_id() or is_admin());
-- inserts/updates only via service role (checkout + webhooks + admin API)

create policy order_items_read on order_items for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.buyer_id = auth.uid() or o.vendor_id = my_vendor_id() or is_admin())));
create policy order_events_read on order_events for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.buyer_id = auth.uid() or o.vendor_id = my_vendor_id() or is_admin())));

-- payments & ledger: buyer sees own payment status; vendor sees own earnings; writes = service role only
create policy payments_read on payments for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.buyer_id = auth.uid() or o.vendor_id = my_vendor_id() or is_admin())));
create policy ledger_vendor_read on payment_ledger for select
  using (vendor_id = my_vendor_id() or is_admin());
create policy commission_admin on commission_rules for all using (is_admin());
create policy commission_vendor_read on commission_rules for select
  using (vendor_id = my_vendor_id() or scope = 'platform' or is_admin());

-- shipments & tracking: parties read; writes = service role (label generation + carrier webhooks)
create policy shipments_read on shipments for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.buyer_id = auth.uid() or o.vendor_id = my_vendor_id() or is_admin())));
create policy tracking_read on tracking_events for select using (
  exists (select 1 from shipments s join orders o on o.id = s.order_id
          where s.id = shipment_id
          and (o.buyer_id = auth.uid() or o.vendor_id = my_vendor_id() or is_admin())));

-- payouts & reserves
create policy payouts_vendor_read on payouts for select using (vendor_id = my_vendor_id() or is_admin());
create policy payouts_admin on payouts for update using (is_admin());
create policy payout_items_read on payout_items for select using (
  exists (select 1 from payouts p where p.id = payout_id and (p.vendor_id = my_vendor_id() or is_admin())));
create policy reserves_vendor_read on vendor_reserves for select using (vendor_id = my_vendor_id() or is_admin());
create policy reserves_admin on vendor_reserves for all using (is_admin());
create policy holds_read on payout_holds for select using (vendor_id = my_vendor_id() or is_admin());
create policy holds_admin on payout_holds for all using (is_admin());

-- fraud & risk: admin only
create policy fraud_admin on fraud_flags for all using (is_admin());
create policy risk_admin on risk_scores for select using (is_admin());

-- reviews: public read of published; buyer insert only on own delivered order;
-- buyer may edit own within 30 days; NO vendor grants; NO deletes for anyone.
create policy reviews_public_read on reviews for select
  using (status = 'published' or buyer_id = auth.uid() or is_admin());
create policy reviews_buyer_insert on reviews for insert with check (
  buyer_id = auth.uid()
  and exists (select 1 from orders o where o.id = order_id
              and o.buyer_id = auth.uid() and o.status = 'completed'));
create policy reviews_buyer_edit on reviews for update
  using (buyer_id = auth.uid() and created_at > now() - interval '30 days')
  with check (buyer_id = auth.uid() and status = 'published' and moderated_by is null);
create policy reviews_admin_moderate on reviews for update using (is_admin());

-- messaging: participants read; insert only; NO update/delete policies exist → immutable
create policy threads_read on message_threads for select using (
  buyer_id = auth.uid() or vendor_id = my_vendor_id() or is_admin()
  or application_id in (select id from vendor_applications where applicant_id = auth.uid()));
create policy threads_insert on message_threads for insert with check (
  buyer_id = auth.uid() or vendor_id = my_vendor_id() or is_admin());
create policy messages_read on messages for select using (
  exists (select 1 from message_threads t where t.id = thread_id
          and (t.buyer_id = auth.uid() or t.vendor_id = my_vendor_id() or is_admin()
               or t.application_id in (select id from vendor_applications where applicant_id = auth.uid()))));
create policy messages_insert on messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from message_threads t where t.id = thread_id
          and (t.buyer_id = auth.uid() or t.vendor_id = my_vendor_id() or is_admin())));
create policy mflags_admin on message_flags for all using (is_admin());
create policy notes_admin on internal_notes for all using (is_admin());

-- disputes
create policy disputes_read on disputes for select
  using (buyer_id = auth.uid() or vendor_id = my_vendor_id() or is_admin());
create policy disputes_buyer_open on disputes for insert with check (
  buyer_id = auth.uid()
  and exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid()
              and o.status = 'delivered'
              and o.dispute_window_ends_at > now()));
create policy disputes_admin on disputes for update using (is_admin());
create policy devidence_parties on dispute_evidence for select using (
  exists (select 1 from disputes d where d.id = dispute_id
          and (d.buyer_id = auth.uid() or d.vendor_id = my_vendor_id() or is_admin())));
create policy devidence_insert on dispute_evidence for insert with check (
  submitted_by = auth.uid()
  and exists (select 1 from disputes d where d.id = dispute_id
          and (d.buyer_id = auth.uid() or d.vendor_id = my_vendor_id())
          and d.status not in ('resolved','closed')));
create policy devents_read on dispute_events for select using (
  exists (select 1 from disputes d where d.id = dispute_id
          and (d.buyer_id = auth.uid() or d.vendor_id = my_vendor_id() or is_admin())));

-- wholesale
create policy wp_own on wholesale_profiles for all using (profile_id = auth.uid() or is_admin());
create policy wa_parties on wholesale_access for select
  using (buyer_id = auth.uid() or vendor_id = my_vendor_id() or is_admin());
create policy wa_request on wholesale_access for insert with check (buyer_id = auth.uid());
create policy wa_vendor_decide on wholesale_access for update
  using (vendor_id = my_vendor_id() or is_admin());
create policy wi_parties on wholesale_inquiries for select
  using (buyer_id = auth.uid() or vendor_id = my_vendor_id() or is_admin());
create policy wi_insert on wholesale_inquiries for insert with check (buyer_id = auth.uid());
create policy ra_admin on referral_attributions for select using (is_admin() or vendor_id = my_vendor_id());

-- governance
create policy jr_read on jurisdiction_rules for select using (true);
create policy jr_admin on jurisdiction_rules for all using (is_admin());
create policy agp_read on age_gate_policies for select using (true);
create policy agp_admin on age_gate_policies for all using (is_admin());
create policy sp_read on sponsored_placements for select using (true);
create policy sp_admin on sponsored_placements for all using (is_admin());
create policy fp_read on featured_placements for select using (true);
create policy fp_admin on featured_placements for all using (is_admin());
create policy ps_admin on platform_settings for all using (is_admin());
create policy lr_insert on listing_reports for insert with check (true);  -- public reporting
create policy lr_admin on listing_reports for select using (is_admin());
create policy audit_admin_read on audit_logs for select using (is_admin());
-- audit_logs writes happen via security-definer trigger only
