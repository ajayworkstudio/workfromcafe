-- Monetisasi: owner kafe, paket ①–⑤, saldo iklan, dan lelang slot Sponsored (ala SEM).
-- Sudah diterapkan ke proyek Supabase workfromcafe pada 31 Okt 2026 (migrasi cafe_ads_monetization).

-- ---------- 1. Owner & paket ----------
create table public.cafe_owners (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references public.cafes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner','staff')),
  verified_at timestamptz,                       -- diisi admin setelah verifikasi
  created_at  timestamptz not null default now(),
  unique (cafe_id, user_id)
);
create index on public.cafe_owners (user_id);

create table public.cafe_plans (
  id                   smallint primary key check (id between 1 and 5),
  name                 text not null,
  monthly_price        bigint not null check (monthly_price >= 0),
  can_bid              boolean not null default false,
  bonus_ad_credit      bigint not null default 0,
  max_active_campaigns smallint not null default 0,
  features             jsonb not null default '{}'
);
insert into public.cafe_plans (id, name, monthly_price, can_bid, bonus_ad_credit, max_active_campaigns) values
  (1,'Basic',0,false,0,0),
  (2,'Starter',99000,true,25000,1),
  (3,'Growth',199000,true,60000,3),
  (4,'Pro',399000,true,150000,5),
  (5,'Partner',799000,true,350000,10);

create table public.cafe_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  cafe_id      uuid not null references public.cafes(id) on delete cascade,
  plan_id      smallint not null references public.cafe_plans(id),
  status       text not null default 'pending' check (status in ('pending','active','expired','cancelled')),
  starts_at    date,
  ends_at      date,
  payment_ref  text,
  confirmed_by uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index on public.cafe_subscriptions (cafe_id, status, ends_at);

-- ---------- 2. Saldo iklan ----------
create table public.ad_wallets (
  cafe_id    uuid primary key references public.cafes(id) on delete cascade,
  balance    bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id            bigint generated always as identity primary key,
  cafe_id       uuid not null references public.ad_wallets(cafe_id) on delete cascade,
  type          text not null check (type in ('topup','bonus','click_charge','impression_charge','refund','adjustment')),
  amount        bigint not null,
  balance_after bigint not null,
  ref_id        text,
  note          text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index on public.wallet_transactions (cafe_id, created_at desc);

-- ---------- 3. Kampanye & target ----------
create table public.ad_campaigns (
  id            uuid primary key default gen_random_uuid(),
  cafe_id       uuid not null references public.cafes(id) on delete cascade,
  name          text not null,
  status        text not null default 'active' check (status in ('draft','active','paused','ended','out_of_budget')),
  pricing_model text not null default 'cpc' check (pricing_model in ('cpc','cpm')),
  daily_budget  bigint not null check (daily_budget > 0),
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.ad_campaigns (cafe_id, status);

create table public.ad_targets (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.ad_campaigns(id) on delete cascade,
  target_type  text not null check (target_type in ('city','area','tag','keyword')),
  target_value text not null,
  max_bid      bigint not null check (max_bid >= 500),
  is_active    boolean not null default true,
  unique (campaign_id, target_type, target_value)
);
create index on public.ad_targets (target_type, lower(target_value)) where is_active;

-- ---------- 4. Skor kualitas ----------
create table public.cafe_quality_scores (
  cafe_id       uuid primary key references public.cafes(id) on delete cascade,
  rating_score  numeric(4,3) not null default 0.5 check (rating_score between 0 and 1),
  curator_score numeric(4,3) not null default 0.5 check (curator_score between 0 and 1),
  ctr_score     numeric(4,3) not null default 0.5 check (ctr_score between 0 and 1),
  quality_score numeric(4,3) generated always as
                (greatest(0.1, 0.4*rating_score + 0.4*curator_score + 0.2*ctr_score)) stored,
  updated_at    timestamptz not null default now()
);

-- ---------- 5. Slot ----------
create table public.ad_placements (
  code          text primary key,
  description   text,
  max_slots     smallint not null default 3,
  reserve_price bigint not null default 500
);
insert into public.ad_placements values
  ('search_top','Atas hasil pencarian',3,500),
  ('city_home','Halaman utama kota',2,1000),
  ('category_top','Atas halaman kategori/tag',2,700);

-- ---------- 6. Log tayang & klik ----------
create table public.ad_impressions (
  id            bigint generated always as identity primary key,
  auction_id    uuid not null,
  campaign_id   uuid not null references public.ad_campaigns(id) on delete cascade,
  target_id     uuid not null references public.ad_targets(id) on delete cascade,
  cafe_id       uuid not null references public.cafes(id) on delete cascade,
  placement     text not null references public.ad_placements(code),
  position      smallint not null,
  bid           bigint not null,
  quality_score numeric(4,3) not null,
  ad_rank       numeric not null,
  price         bigint not null,
  query         text,
  viewer_hash   text,
  created_at    timestamptz not null default now()
);
create index on public.ad_impressions (campaign_id, created_at);
create index on public.ad_impressions (cafe_id, created_at);

create table public.ad_clicks (
  id            bigint generated always as identity primary key,
  impression_id bigint not null unique references public.ad_impressions(id) on delete cascade,
  cafe_id       uuid not null references public.cafes(id) on delete cascade,
  charged       bigint not null,
  is_valid      boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on public.ad_clicks (cafe_id, created_at);

-- =====================================================================
-- 7. Helper: apakah user login adalah owner terverifikasi kafe ini?
-- =====================================================================
create or replace function public.is_cafe_owner(p_cafe_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.cafe_owners
    where cafe_id = p_cafe_id and user_id = auth.uid() and verified_at is not null
  );
$$;

-- =====================================================================
-- 8. Lelang (internal, tidak bisa dipanggil langsung dari aplikasi)
--    ad_rank = max_bid × quality_score
--    harga   = ad_rank peringkat bawahnya ÷ quality_score sendiri + Rp100,
--              minimal reserve price, maksimal max_bid (GSP)
-- =====================================================================
create or replace function public.run_ad_auction(
  p_placement text, p_target_type text, p_target_value text
)
returns table (
  out_position smallint, out_cafe_id uuid, out_campaign_id uuid, out_target_id uuid,
  out_bid bigint, out_quality numeric, out_ad_rank numeric, out_price bigint
)
language sql stable security definer set search_path = public
as $$
  with cfg as (
    select max_slots, reserve_price from public.ad_placements where code = p_placement
  ),
  spend_today as (
    select i.campaign_id, coalesce(sum(c.charged),0) as spent
    from public.ad_clicks c
    join public.ad_impressions i on i.id = c.impression_id
    where c.is_valid and c.created_at >= date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
    group by i.campaign_id
  ),
  eligible as (
    select distinct on (cp.cafe_id)
      cp.cafe_id, cp.id as campaign_id, t.id as target_id, t.max_bid,
      coalesce(q.quality_score, 0.5) as qs,
      t.max_bid * coalesce(q.quality_score, 0.5) as ad_rank
    from public.ad_targets t
    join public.ad_campaigns cp      on cp.id = t.campaign_id
    join public.cafes cf             on cf.id = cp.cafe_id and cf.is_published
    join public.ad_wallets w         on w.cafe_id = cp.cafe_id
    join public.cafe_subscriptions s on s.cafe_id = cp.cafe_id and s.status = 'active'
                                    and (now() at time zone 'Asia/Jakarta')::date between s.starts_at and s.ends_at
    join public.cafe_plans pl        on pl.id = s.plan_id and pl.can_bid
    left join public.cafe_quality_scores q on q.cafe_id = cp.cafe_id
    left join spend_today st         on st.campaign_id = cp.id
    cross join cfg
    where t.is_active
      and t.target_type = p_target_type
      and lower(t.target_value) = lower(p_target_value)
      and cp.status = 'active'
      and now() >= cp.starts_at and (cp.ends_at is null or now() < cp.ends_at)
      and t.max_bid >= cfg.reserve_price
      and w.balance >= t.max_bid
      and coalesce(st.spent,0) + t.max_bid <= cp.daily_budget
    order by cp.cafe_id, t.max_bid * coalesce(q.quality_score, 0.5) desc
  ),
  ranked as (
    select e.*,
           row_number() over (order by ad_rank desc, max_bid desc) as pos,
           lead(ad_rank) over (order by ad_rank desc, max_bid desc) as next_rank
    from eligible e
  )
  select pos::smallint, cafe_id, campaign_id, target_id, max_bid, qs, ad_rank,
         least(max_bid, greatest((select reserve_price from cfg),
               ceil(coalesce(next_rank, (select reserve_price from cfg) * qs) / qs)::bigint + 100))
  from ranked
  where pos <= (select max_slots from cfg)
  order by pos;
$$;

-- =====================================================================
-- 9. RPC publik: tampilkan iklan + catat impression
--    Dipanggil frontend: supabase.rpc('serve_sponsored', {...})
--    Hanya mengembalikan id tayang + kafe + posisi (tawaran pesaing tidak bocor)
-- =====================================================================
create or replace function public.serve_sponsored(
  p_placement text, p_target_type text, p_target_value text,
  p_viewer_hash text default null, p_query text default null
)
returns table (impression_id bigint, cafe_id uuid, slot smallint)
language plpgsql volatile security definer set search_path = public
as $$
declare v_auction uuid := gen_random_uuid();
begin
  return query
  with a as (select * from public.run_ad_auction(p_placement, p_target_type, p_target_value)),
  ins as (
    insert into public.ad_impressions
      (auction_id, campaign_id, target_id, cafe_id, placement, position, bid, quality_score, ad_rank, price, query, viewer_hash)
    select v_auction, out_campaign_id, out_target_id, out_cafe_id, p_placement, out_position,
           out_bid, out_quality, out_ad_rank, out_price, left(p_query,200), left(p_viewer_hash,128)
    from a
    returning id, ad_impressions.cafe_id, position
  )
  select ins.id, ins.cafe_id, ins.position from ins order by ins.position;
end;
$$;

-- =====================================================================
-- 10. RPC publik: catat klik & potong saldo (atomik)
--     Tidak ditagih jika: impression > 1 jam, sudah diklik,
--     atau viewer sama klik kafe sama dalam 30 menit.
-- =====================================================================
create or replace function public.record_ad_click(p_impression_id bigint)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_imp public.ad_impressions%rowtype;
  v_bal bigint;
begin
  select * into v_imp from public.ad_impressions where id = p_impression_id;
  if not found or v_imp.created_at < now() - interval '1 hour' then return; end if;
  if exists (select 1 from public.ad_clicks where impression_id = p_impression_id) then return; end if;

  if v_imp.viewer_hash is null or exists (
    select 1 from public.ad_clicks c join public.ad_impressions i on i.id = c.impression_id
    where i.cafe_id = v_imp.cafe_id and i.viewer_hash = v_imp.viewer_hash
      and c.is_valid and c.created_at > now() - interval '30 minutes'
  ) then
    insert into public.ad_clicks (impression_id, cafe_id, charged, is_valid)
    values (p_impression_id, v_imp.cafe_id, 0, false) on conflict (impression_id) do nothing;
    return;
  end if;

  update public.ad_wallets set balance = balance - v_imp.price, updated_at = now()
  where cafe_id = v_imp.cafe_id and balance >= v_imp.price
  returning balance into v_bal;

  if not found then
    update public.ad_campaigns set status = 'out_of_budget' where id = v_imp.campaign_id;
    return;
  end if;

  insert into public.ad_clicks (impression_id, cafe_id, charged)
  values (p_impression_id, v_imp.cafe_id, v_imp.price) on conflict (impression_id) do nothing;

  insert into public.wallet_transactions (cafe_id, type, amount, balance_after, ref_id)
  values (v_imp.cafe_id, 'click_charge', -v_imp.price, v_bal, p_impression_id::text);
end;
$$;

-- =====================================================================
-- 11. RPC admin: top-up / bonus / koreksi saldo
-- =====================================================================
create or replace function public.admin_wallet_adjust(
  p_cafe_id uuid, p_amount bigint, p_type text default 'topup', p_note text default null
)
returns bigint
language plpgsql volatile security definer set search_path = public
as $$
declare v_bal bigint;
begin
  if not public.is_admin() then raise exception 'khusus admin'; end if;
  if p_type not in ('topup','bonus','refund','adjustment') then raise exception 'type tidak valid'; end if;

  insert into public.ad_wallets (cafe_id, balance) values (p_cafe_id, 0) on conflict do nothing;
  update public.ad_wallets set balance = balance + p_amount, updated_at = now()
  where cafe_id = p_cafe_id returning balance into v_bal;

  insert into public.wallet_transactions (cafe_id, type, amount, balance_after, note, created_by)
  values (p_cafe_id, p_type, p_amount, v_bal, p_note, auth.uid());
  return v_bal;
end;
$$;

-- ---------- Hak eksekusi fungsi ----------
revoke all on function public.run_ad_auction(text,text,text) from public, anon, authenticated;
revoke all on function public.serve_sponsored(text,text,text,text,text) from public;
revoke all on function public.record_ad_click(bigint) from public;
revoke all on function public.admin_wallet_adjust(uuid,bigint,text,text) from public, anon;
revoke all on function public.is_cafe_owner(uuid) from public, anon;
grant execute on function public.serve_sponsored(text,text,text,text,text) to anon, authenticated;
grant execute on function public.record_ad_click(bigint) to anon, authenticated;
grant execute on function public.admin_wallet_adjust(uuid,bigint,text,text) to authenticated;
grant execute on function public.is_cafe_owner(uuid) to authenticated;

-- =====================================================================
-- 12. RLS
-- =====================================================================
alter table public.cafe_owners         enable row level security;
alter table public.cafe_plans          enable row level security;
alter table public.cafe_subscriptions  enable row level security;
alter table public.ad_wallets          enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.ad_campaigns        enable row level security;
alter table public.ad_targets          enable row level security;
alter table public.cafe_quality_scores enable row level security;
alter table public.ad_placements       enable row level security;
alter table public.ad_impressions      enable row level security;
alter table public.ad_clicks           enable row level security;

-- Daftar paket & slot: publik boleh lihat (untuk halaman harga)
create policy "plans_public_read"      on public.cafe_plans    for select using (true);
create policy "placements_public_read" on public.ad_placements for select using (true);
create policy "plans_admin_all"        on public.cafe_plans    for all using (public.is_admin()) with check (public.is_admin());
create policy "placements_admin_all"   on public.ad_placements for all using (public.is_admin()) with check (public.is_admin());

-- Owner: lihat keterkaitannya sendiri; boleh mengajukan klaim kafe (belum terverifikasi)
create policy "owners_self_read"  on public.cafe_owners for select using (user_id = auth.uid() or public.is_admin());
create policy "owners_self_claim" on public.cafe_owners for insert
  with check (user_id = auth.uid() and verified_at is null);
create policy "owners_admin_all"  on public.cafe_owners for all using (public.is_admin()) with check (public.is_admin());

-- Langganan: owner lihat & ajukan (pending); admin yang mengaktifkan
create policy "subs_owner_read"   on public.cafe_subscriptions for select using (public.is_cafe_owner(cafe_id) or public.is_admin());
create policy "subs_owner_request" on public.cafe_subscriptions for insert
  with check (public.is_cafe_owner(cafe_id) and status = 'pending' and confirmed_by is null);
create policy "subs_admin_all"    on public.cafe_subscriptions for all using (public.is_admin()) with check (public.is_admin());

-- Saldo & mutasi: owner hanya baca; perubahan lewat fungsi
create policy "wallet_owner_read" on public.ad_wallets          for select using (public.is_cafe_owner(cafe_id) or public.is_admin());
create policy "wtx_owner_read"    on public.wallet_transactions for select using (public.is_cafe_owner(cafe_id) or public.is_admin());

-- Kampanye & target: owner kelola miliknya sendiri
create policy "camp_owner_all" on public.ad_campaigns for all
  using (public.is_cafe_owner(cafe_id) or public.is_admin())
  with check (public.is_cafe_owner(cafe_id) or public.is_admin());
create policy "targets_owner_all" on public.ad_targets for all
  using (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and (public.is_cafe_owner(c.cafe_id) or public.is_admin())))
  with check (exists (select 1 from public.ad_campaigns c where c.id = campaign_id and (public.is_cafe_owner(c.cafe_id) or public.is_admin())));

-- Skor kualitas: owner boleh lihat skornya; hanya admin yang ubah
create policy "qs_owner_read" on public.cafe_quality_scores for select using (public.is_cafe_owner(cafe_id) or public.is_admin());
create policy "qs_admin_all"  on public.cafe_quality_scores for all using (public.is_admin()) with check (public.is_admin());

-- Log: owner baca statistik kafenya (tulis hanya lewat fungsi)
create policy "imp_owner_read"   on public.ad_impressions for select using (public.is_cafe_owner(cafe_id) or public.is_admin());
create policy "click_owner_read" on public.ad_clicks      for select using (public.is_cafe_owner(cafe_id) or public.is_admin());
