-- 0003_auth_and_settlement.sql
-- 1) Idempotent profile creation on signup (app also self-heals via service role)
-- 2) Atomic settlement ledger posting (called by the BTCPay webhook)
-- 3) Checkout idempotency key
-- Admin bootstrap emails: keep in sync with MARKETPLACE_ADMIN_EMAILS.

-- ============================================================ profiles on signup
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case
      when lower(coalesce(new.email, '')) in ('webadmin@buyhempflowernearme.com') then 'admin'::user_role
      else 'buyer'::user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================ settlement ledger
-- Posts the four settlement entries exactly once per order (idempotent by
-- checking for an existing buyer_payment row). Reserve percentage comes from
-- vendor_reserves, defaulting to the new-vendor policy.
create or replace function post_settlement_ledger(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_reserve_pct numeric;
  v_vendor_earnings int;
  v_reserve_hold int;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  -- idempotency: settle once
  if exists (select 1 from payment_ledger
             where order_id = p_order_id and entry_type = 'buyer_payment') then
    return;
  end if;

  select coalesce(
    (select reserve_pct from vendor_reserves where vendor_id = v_order.vendor_id),
    (select (value->>'pct')::numeric from platform_settings where key = 'new_vendor_reserve'),
    0.15
  ) into v_reserve_pct;

  v_vendor_earnings := v_order.total_cents - v_order.commission_cents;
  v_reserve_hold := round(v_vendor_earnings * v_reserve_pct);

  insert into payment_ledger (order_id, vendor_id, entry_type, amount_cents, memo) values
    (p_order_id, v_order.vendor_id, 'buyer_payment',       v_order.total_cents,               'Invoice settled'),
    (p_order_id, v_order.vendor_id, 'platform_commission', -v_order.commission_cents,          'Commission @ ' || v_order.commission_rate),
    (p_order_id, v_order.vendor_id, 'vendor_earnings',     v_vendor_earnings - v_reserve_hold, 'Earnings net of reserve'),
    (p_order_id, v_order.vendor_id, 'reserve_hold',        v_reserve_hold,                     'Rolling reserve @ ' || v_reserve_pct);
end $$;

-- ============================================================ checkout idempotency
alter table orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key_uidx
  on orders (idempotency_key) where idempotency_key is not null;

-- ============================================================ application autosave upsert
-- One draft application per applicant keeps autosave upserts unambiguous.
create unique index if not exists vendor_applications_one_draft_uidx
  on vendor_applications (applicant_id) where status in ('draft','info_requested');
