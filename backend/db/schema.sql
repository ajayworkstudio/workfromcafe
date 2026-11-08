-- Struktur database WFC Hunters (skema public), dibuat dari migrasi 0001-0031 tanpa 0030.
-- Muat setelah 00_supabase_shim.sql. Dipakai untuk database baru dan untuk sqlc.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS public;

COMMENT ON SCHEMA public IS 'standard public schema';

CREATE FUNCTION public.admin_stats() RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then raise exception 'Hanya admin'; end if;
  return json_build_object(
    'cafes',           (select count(*) from cafes),
    'cafes_draft',     (select count(*) from cafes where not is_published),
    'users',           (select count(*) from profiles),
    'active_subs',     (select count(distinct user_id) from subscriptions where status = 'active' and end_date > now()),
    'revenue_month',   (select coalesce(sum(amount), 0) from payments where status = 'paid' and created_at >= date_trunc('month', now())),
    'revenue_total',   (select coalesce(sum(amount), 0) from payments where status = 'paid'),
    'expiring_7d',     (select count(*) from subscriptions where status = 'active' and end_date between now() and now() + interval '7 days')
  );
end $$;

CREATE FUNCTION public.admin_usage_counts() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case when public.is_admin() then json_build_object(
    'tags',   (select coalesce(json_object_agg(tag_id, n), '{}'::json) from (select tag_id, count(*) n from cafe_tags group by tag_id) x),
    'cities', (select coalesce(json_object_agg(city_id, n), '{}'::json) from (select city_id, count(*) n from cafes group by city_id) y)
  ) else null end;
$$;

CREATE FUNCTION public.admin_wallet_adjust(p_cafe_id uuid, p_amount bigint, p_type text DEFAULT 'topup'::text, p_note text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.article_like_count_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.articles set like_count = like_count + 1 where id = new.article_id;
  else
    update public.articles set like_count = greatest(0, like_count - 1) where id = old.article_id;
  end if;
  return null;
end;
$$;

CREATE FUNCTION public.author_card(p_id uuid) RETURNS TABLE(name text, avatar_url text, bio text, instagram text, username text, cafe_count integer, is_admin boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.name, p.avatar_url, p.bio, p.instagram, p.username,
         (select count(*)::int from public.cafes c where c.contributor_id = p.id and c.is_published),
         p.role = 'admin'
  from public.profiles p
  where p.id = p_id
    and exists (select 1 from public.cafes c where c.contributor_id = p_id and c.is_published);
$$;

CREATE FUNCTION public.authors_list() RETURNS TABLE(id uuid, name text, avatar_url text, bio text, instagram text, username text, cafe_count integer, month_count integer, first_at timestamp with time zone, last_at timestamp with time zone, is_admin boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id, coalesce(nullif(p.name, ''), 'Author'), p.avatar_url, p.bio, p.instagram, p.username,
         count(c.id)::int,
         count(c.id) filter (where c.created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')::int,
         min(c.created_at), max(c.created_at),
         p.role = 'admin'
  from public.profiles p
  join public.cafes c on c.contributor_id = p.id and c.is_published
  group by p.id
  order by count(c.id) desc, max(c.created_at) desc;
$$;

CREATE FUNCTION public.cafe_comments_list(p_cafe_id uuid) RETURNS TABLE(id uuid, parent_id uuid, body text, created_at timestamp with time zone, user_id uuid, author_name text, author_avatar text, author_is_admin boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.id, c.parent_id, c.body, c.created_at,
         c.user_id, coalesce(nullif(p.name, ''), 'Pengguna'), p.avatar_url, p.role = 'admin'
  from public.cafe_comments c
  join public.profiles p on p.id = c.user_id
  join public.cafes f on f.id = c.cafe_id
  where c.cafe_id = p_cafe_id
    and not c.is_hidden
    and (f.is_published or public.is_admin())
  order by c.created_at;
$$;

CREATE FUNCTION public.cafe_reports_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if exists (
    select 1 from public.cafe_reports
    where user_id = new.user_id and cafe_id = new.cafe_id and created_at > now() - interval '3 hours'
  ) then
    raise exception 'Kamu sudah melapor kafe ini dalam 3 jam terakhir.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.cafe_reports where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Batas laporan hari ini sudah tercapai.' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;

CREATE FUNCTION public.cafe_reports_live() RETURNS TABLE(cafe_id uuid, crowd smallint, plugs smallint, download_mbps numeric, reports integer, last_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with recent as (
    select r.* from public.cafe_reports r
    join public.cafes f on f.id = r.cafe_id and f.is_published
    where r.created_at > now() - interval '3 hours'
  )
  select x.cafe_id,
         (select crowd from recent a where a.cafe_id = x.cafe_id order by created_at desc limit 1),
         (select plugs from recent a where a.cafe_id = x.cafe_id and plugs is not null order by created_at desc limit 1),
         (select round(percentile_cont(0.5) within group (order by download_mbps)::numeric, 0)
            from recent a where a.cafe_id = x.cafe_id and download_mbps is not null),
         count(*)::integer,
         max(x.created_at)
  from recent x
  group by x.cafe_id;
$$;

CREATE FUNCTION public.cafe_reports_recent(p_cafe_id uuid) RETURNS TABLE(id uuid, crowd smallint, plugs smallint, download_mbps numeric, upload_mbps numeric, ping_ms integer, note text, created_at timestamp with time zone, user_id uuid, author_name text, author_avatar text, author_is_admin boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.id, r.crowd, r.plugs, r.download_mbps, r.upload_mbps, r.ping_ms, r.note, r.created_at,
         r.user_id, coalesce(nullif(p.name, ''), 'Pengguna'), p.avatar_url, p.role = 'admin'
  from public.cafe_reports r
  join public.profiles p on p.id = r.user_id
  join public.cafes f on f.id = r.cafe_id
  where r.cafe_id = p_cafe_id
    and (f.is_published or public.is_admin())
  order by r.created_at desc
  limit 10;
$$;

CREATE FUNCTION public.cafe_stats(p_cafe_id uuid, p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  t0 timestamptz := (date_trunc('day', now() at time zone 'Asia/Jakarta') - make_interval(days => d - 1)) at time zone 'Asia/Jakarta';
  tp timestamptz := t0 - make_interval(days => d);
  out jsonb;
begin
  if not (public.is_admin() or public.is_cafe_owner(p_cafe_id)) then raise exception 'tidak berhak'; end if;
  with e as (select * from public.cafe_events where cafe_id = p_cafe_id and created_at >= tp),
  cur as (select * from e where created_at >= t0),
  prev as (select * from e where created_at < t0)
  select jsonb_build_object(
    'days', d,
    'views', (select count(*) from cur where kind = 'view'),
    'visitors', (select count(distinct viewer_hash) from cur where kind = 'view'),
    'prev_views', (select count(*) from prev where kind = 'view'),
    'prev_visitors', (select count(distinct viewer_hash) from prev where kind = 'view'),
    'actions', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from cur where kind <> 'view' group by kind) a),
    'prev_actions', (select count(*) from prev where kind <> 'view'),
    'sources', (select coalesce(jsonb_object_agg(source, n), '{}') from (select source, count(*) n from cur where kind = 'view' group by source) s),
    'devices', (select coalesce(jsonb_object_agg(device, n), '{}') from (select device, count(*) n from cur where kind = 'view' group by device) v),
    'logged_in', (select count(*) from cur where kind = 'view' and logged_in),
    'cities', (select coalesce(jsonb_agg(jsonb_build_object('city', visitor_city, 'n', n) order by n desc), '[]')
               from (select visitor_city, count(*) n from cur where kind = 'view' and visitor_city is not null
                     group by visitor_city order by n desc limit 6) c),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', day, 'views', coalesce(x.views, 0), 'visitors', coalesce(x.visitors, 0)) order by day), '[]')
              from generate_series((t0 at time zone 'Asia/Jakarta')::date, (now() at time zone 'Asia/Jakarta')::date, interval '1 day') g(day)
              left join (select (created_at at time zone 'Asia/Jakarta')::date dd, count(*) views, count(distinct viewer_hash) visitors
                         from cur where kind = 'view' group by 1) x on x.dd = g.day::date),
    'favorites', (select count(*) from public.favorites where cafe_id = p_cafe_id),
    'hours', (select coalesce(jsonb_object_agg(h, n), '{}') from (
               select extract(hour from created_at at time zone 'Asia/Jakarta')::int h, count(*) n
               from cur where kind = 'view' group by 1) hh)
  ) into out;
  return out;
end;
$$;

CREATE FUNCTION public.cafes_stats_overview(p_days integer DEFAULT 30) RETURNS TABLE(cafe_id uuid, name text, slug text, city text, views bigint, visitors bigint, actions bigint, prev_views bigint, favorites bigint, has_owner boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  t0 timestamptz := (date_trunc('day', now() at time zone 'Asia/Jakarta') - make_interval(days => d - 1)) at time zone 'Asia/Jakarta';
  tp timestamptz := t0 - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'khusus admin'; end if;
  return query
  select c.id, c.name, c.slug, ci.name,
    count(*) filter (where e.kind = 'view' and e.created_at >= t0),
    count(distinct e.viewer_hash) filter (where e.kind = 'view' and e.created_at >= t0),
    count(*) filter (where e.kind <> 'view' and e.created_at >= t0),
    count(*) filter (where e.kind = 'view' and e.created_at < t0),
    (select count(*) from public.favorites f where f.cafe_id = c.id),
    exists (select 1 from public.cafe_owners o where o.cafe_id = c.id and o.verified_at is not null)
  from public.cafes c
  left join public.cities ci on ci.id = c.city_id
  left join public.cafe_events e on e.cafe_id = c.id and e.created_at >= tp
  where c.is_published
  group by c.id, c.name, c.slug, ci.name
  order by 5 desc, c.name;
end;
$$;

CREATE FUNCTION public.can_view_full(p_cafe_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.free_mode()
      or public.is_admin()
      or public.is_premium()
      or exists (select 1 from public.cafe_unlocks where user_id = auth.uid() and cafe_id = p_cafe_id);
$$;

CREATE FUNCTION public.free_mode() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select value = 'true' from public.app_settings where key = 'free_mode'), false);
$$;

CREATE FUNCTION public.free_unlocks_left() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select greatest(0,
    (select value::int from public.app_settings where key = 'free_unlock_limit_per_month')
    - (select count(*)::int from public.cafe_unlocks
       where user_id = auth.uid() and unlocked_at >= date_trunc('month', now()))
  );
$$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_days int;
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  select coalesce(nullif(value, '')::int, 0) into v_days from public.app_settings where key = 'trial_days';
  if coalesce(v_days, 0) > 0 and not public.free_mode() then
    insert into public.subscriptions (user_id, plan, status, start_date, end_date, amount)
    values (new.id, 'trial', 'active', now(), now() + make_interval(days => v_days), 0);
  end if;
  return new;
end $$;

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

CREATE FUNCTION public.is_cafe_claimant(p_cafe_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select exists (select 1 from public.cafe_owners where cafe_id = p_cafe_id and user_id = auth.uid()); $$;

CREATE FUNCTION public.is_cafe_owner(p_cafe_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.cafe_owners
    where cafe_id = p_cafe_id and user_id = auth.uid() and verified_at is not null
  );
$$;

CREATE FUNCTION public.is_premium() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.subscriptions
    where user_id = auth.uid() and status = 'active' and end_date > now()
  );
$$;

CREATE FUNCTION public.log_article_view(p_article_id uuid, p_viewer text, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from public.articles where id = p_article_id and is_published) then return; end if;
  if p_user_id is not null and exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then return; end if;
  if exists (select 1 from public.article_views where article_id = p_article_id and viewer_hash = p_viewer
             and created_at > now() - interval '30 minutes') then return; end if;
  insert into public.article_views (article_id, viewer_hash) values (p_article_id, left(p_viewer, 64));
  update public.articles set view_count = view_count + 1 where id = p_article_id;
end;
$$;

CREATE FUNCTION public.log_cafe_event(p_cafe_id uuid, p_kind text, p_viewer text, p_source text, p_device text, p_city text, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not exists (select 1 from public.cafes where id = p_cafe_id and is_published) then return; end if;
  if p_user_id is not null and (
    exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
    or exists (select 1 from public.cafe_owners where cafe_id = p_cafe_id and user_id = p_user_id)
  ) then return; end if;
  if exists (
    select 1 from public.cafe_events
    where cafe_id = p_cafe_id and kind = p_kind and viewer_hash = p_viewer
      and created_at > now() - interval '30 minutes'
  ) then return; end if;
  insert into public.cafe_events (cafe_id, kind, viewer_hash, source, device, visitor_city, logged_in)
  values (p_cafe_id, p_kind, left(p_viewer, 64),
          case when p_source in ('wfc','google','sosial','whatsapp','langsung','lain') then p_source else 'lain' end,
          case when p_device = 'desktop' then 'desktop' else 'hp' end,
          nullif(left(p_city, 60), ''), p_user_id is not null);
end;
$$;

CREATE FUNCTION public.notif_unread_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::int from public.notifications n
  join public.profiles p on p.id = auth.uid()
  where (n.user_id is null or n.user_id = p.id)
    and n.created_at > p.notif_seen_at
    and (p.notif_cleared_at is null or n.created_at > p.notif_cleared_at)
    and not exists (select 1 from public.notification_dismissals d where d.user_id = p.id and d.notification_id = n.id);
$$;

CREATE FUNCTION public.owner_messages_mark_read(p_cafe_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if public.is_admin() then
    update public.owner_messages set read_at = now() where cafe_id = p_cafe_id and not from_admin and read_at is null;
  elsif public.is_cafe_claimant(p_cafe_id) then
    update public.owner_messages set read_at = now() where cafe_id = p_cafe_id and from_admin and read_at is null;
  end if;
end;
$$;

CREATE FUNCTION public.platform_reach(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'views', count(*) filter (where kind = 'view'),
    'visitors', count(distinct viewer_hash) filter (where kind = 'view'),
    'actions', count(*) filter (where kind <> 'view'),
    'cafes', (select count(*) from public.cafes where is_published),
    'cities', (select count(distinct city_id) from public.cafes where is_published)
  )
  from public.cafe_events
  where created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
$$;

CREATE FUNCTION public.protect_role() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- Hanya berlaku untuk request dari aplikasi (role 'authenticated'/'anon').
  -- SQL Editor & service role tetap boleh mengubah role.
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon')
     and not public.is_admin() then
    raise exception 'Tidak boleh mengubah role';
  end if;
  return new;
end $$;

CREATE FUNCTION public.record_ad_click(p_impression_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.run_ad_auction(p_placement text, p_target_type text, p_target_value text) RETURNS TABLE(out_position smallint, out_cafe_id uuid, out_campaign_id uuid, out_target_id uuid, out_bid bigint, out_quality numeric, out_ad_rank numeric, out_price bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.serve_sponsored(p_placement text, p_target_type text, p_target_value text, p_viewer_hash text DEFAULT NULL::text, p_query text DEFAULT NULL::text) RETURNS TABLE(impression_id bigint, cafe_id uuid, slot smallint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

CREATE FUNCTION public.supporters_public(p_limit integer DEFAULT 60) RETURNS TABLE(id uuid, name text, message text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.id, s.name, s.message, s.created_at from public.supporters s
  where not s.is_hidden order by s.created_at desc limit least(greatest(p_limit, 1), 200);
$$;

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end $$;

CREATE FUNCTION public.unlock_cafe(p_cafe_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then return 'not_logged_in'; end if;
  if public.can_view_full(p_cafe_id) then return 'already'; end if;
  if public.free_unlocks_left() <= 0 then return 'quota_exceeded'; end if;
  insert into public.cafe_unlocks (user_id, cafe_id) values (auth.uid(), p_cafe_id);
  return 'ok';
end $$;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.ad_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    pricing_model text DEFAULT 'cpc'::text NOT NULL,
    daily_budget bigint NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_campaigns_daily_budget_check CHECK ((daily_budget > 0)),
    CONSTRAINT ad_campaigns_pricing_model_check CHECK ((pricing_model = ANY (ARRAY['cpc'::text, 'cpm'::text]))),
    CONSTRAINT ad_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'ended'::text, 'out_of_budget'::text])))
);

CREATE TABLE public.ad_clicks (
    id bigint NOT NULL,
    impression_id bigint NOT NULL,
    cafe_id uuid NOT NULL,
    charged bigint NOT NULL,
    is_valid boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.ad_clicks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ad_clicks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.ad_impressions (
    id bigint NOT NULL,
    auction_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    target_id uuid NOT NULL,
    cafe_id uuid NOT NULL,
    placement text NOT NULL,
    "position" smallint NOT NULL,
    bid bigint NOT NULL,
    quality_score numeric(4,3) NOT NULL,
    ad_rank numeric NOT NULL,
    price bigint NOT NULL,
    query text,
    viewer_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.ad_impressions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ad_impressions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.ad_placements (
    code text NOT NULL,
    description text,
    max_slots smallint DEFAULT 3 NOT NULL,
    reserve_price bigint DEFAULT 500 NOT NULL
);

CREATE TABLE public.ad_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    target_type text NOT NULL,
    target_value text NOT NULL,
    max_bid bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT ad_targets_max_bid_check CHECK ((max_bid >= 500)),
    CONSTRAINT ad_targets_target_type_check CHECK ((target_type = ANY (ARRAY['city'::text, 'area'::text, 'tag'::text, 'keyword'::text])))
);

CREATE TABLE public.ad_wallets (
    cafe_id uuid NOT NULL,
    balance bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_wallets_balance_check CHECK ((balance >= 0))
);

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text NOT NULL
);

CREATE TABLE public.article_likes (
    article_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.article_saves (
    article_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.article_views (
    article_id uuid NOT NULL,
    viewer_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text,
    body text DEFAULT ''::text NOT NULL,
    cover_url text,
    city_id uuid,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    author_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    like_count integer DEFAULT 0 NOT NULL,
    meta_title text,
    meta_description text,
    cover_alt text,
    line_spacing text DEFAULT 'normal'::text NOT NULL,
    paragraph_spacing text DEFAULT 'normal'::text NOT NULL,
    CONSTRAINT articles_cover_alt_check CHECK (((cover_alt IS NULL) OR (char_length(cover_alt) <= 160))),
    CONSTRAINT articles_excerpt_check CHECK ((char_length(excerpt) <= 300)),
    CONSTRAINT articles_line_spacing_check CHECK ((line_spacing = ANY (ARRAY['rapat'::text, 'normal'::text, 'lega'::text]))),
    CONSTRAINT articles_meta_description_check CHECK (((meta_description IS NULL) OR (char_length(meta_description) <= 170))),
    CONSTRAINT articles_meta_title_check CHECK (((meta_title IS NULL) OR (char_length(meta_title) <= 70))),
    CONSTRAINT articles_paragraph_spacing_check CHECK ((paragraph_spacing = ANY (ARRAY['rapat'::text, 'normal'::text, 'lega'::text]))),
    CONSTRAINT articles_slug_check CHECK ((slug ~ '^[a-z0-9-]{3,90}$'::text)),
    CONSTRAINT articles_title_check CHECK (((char_length(title) >= 5) AND (char_length(title) <= 120)))
);

CREATE TABLE public.cafe_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    body text NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cafe_comments_body_check CHECK (((char_length(btrim(body)) >= 2) AND (char_length(btrim(body)) <= 1000)))
);

CREATE TABLE public.cafe_details (
    cafe_id uuid NOT NULL,
    full_review text,
    tips text,
    best_time text
);

CREATE TABLE public.cafe_events (
    id bigint NOT NULL,
    cafe_id uuid NOT NULL,
    kind text NOT NULL,
    viewer_hash text NOT NULL,
    source text DEFAULT 'langsung'::text NOT NULL,
    device text DEFAULT 'hp'::text NOT NULL,
    visitor_city text,
    logged_in boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cafe_events_device_check CHECK ((device = ANY (ARRAY['hp'::text, 'desktop'::text]))),
    CONSTRAINT cafe_events_kind_check CHECK ((kind = ANY (ARRAY['view'::text, 'maps'::text, 'menu'::text, 'instagram'::text, 'share'::text, 'whatsapp'::text]))),
    CONSTRAINT cafe_events_source_check CHECK ((source = ANY (ARRAY['wfc'::text, 'google'::text, 'sosial'::text, 'whatsapp'::text, 'langsung'::text, 'lain'::text])))
);

CREATE SEQUENCE public.cafe_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.cafe_events_id_seq OWNED BY public.cafe_events.id;

CREATE TABLE public.cafe_owners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'owner'::text NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cafe_owners_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'staff'::text])))
);

CREATE TABLE public.cafe_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    url text NOT NULL,
    is_cover boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    thumb_url text
);

CREATE TABLE public.cafe_plans (
    id smallint NOT NULL,
    name text NOT NULL,
    monthly_price bigint NOT NULL,
    can_bid boolean DEFAULT false NOT NULL,
    bonus_ad_credit bigint DEFAULT 0 NOT NULL,
    max_active_campaigns smallint DEFAULT 0 NOT NULL,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT cafe_plans_id_check CHECK (((id >= 1) AND (id <= 5))),
    CONSTRAINT cafe_plans_monthly_price_check CHECK ((monthly_price >= 0))
);

CREATE TABLE public.cafe_quality_scores (
    cafe_id uuid NOT NULL,
    rating_score numeric(4,3) DEFAULT 0.5 NOT NULL,
    curator_score numeric(4,3) DEFAULT 0.5 NOT NULL,
    ctr_score numeric(4,3) DEFAULT 0.5 NOT NULL,
    quality_score numeric(4,3) GENERATED ALWAYS AS (GREATEST(0.1, (((0.4 * rating_score) + (0.4 * curator_score)) + (0.2 * ctr_score)))) STORED,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cafe_quality_scores_ctr_score_check CHECK (((ctr_score >= (0)::numeric) AND (ctr_score <= (1)::numeric))),
    CONSTRAINT cafe_quality_scores_curator_score_check CHECK (((curator_score >= (0)::numeric) AND (curator_score <= (1)::numeric))),
    CONSTRAINT cafe_quality_scores_rating_score_check CHECK (((rating_score >= (0)::numeric) AND (rating_score <= (1)::numeric)))
);

CREATE TABLE public.cafe_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    crowd smallint NOT NULL,
    plugs smallint,
    download_mbps numeric(6,1),
    upload_mbps numeric(6,1),
    ping_ms integer,
    note text,
    distance_m integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cafe_reports_crowd_check CHECK (((crowd >= 1) AND (crowd <= 3))),
    CONSTRAINT cafe_reports_download_mbps_check CHECK (((download_mbps >= (0)::numeric) AND (download_mbps <= (2000)::numeric))),
    CONSTRAINT cafe_reports_note_check CHECK ((char_length(note) <= 140)),
    CONSTRAINT cafe_reports_ping_ms_check CHECK (((ping_ms >= 0) AND (ping_ms <= 10000))),
    CONSTRAINT cafe_reports_plugs_check CHECK (((plugs >= 1) AND (plugs <= 3))),
    CONSTRAINT cafe_reports_upload_mbps_check CHECK (((upload_mbps >= (0)::numeric) AND (upload_mbps <= (2000)::numeric)))
);

CREATE TABLE public.cafe_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    author_name text NOT NULL,
    author_instagram text,
    status text DEFAULT 'pending'::text NOT NULL,
    data jsonb NOT NULL,
    admin_note text,
    cafe_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT cafe_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.cafe_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    plan_id smallint NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    starts_at date,
    ends_at date,
    payment_ref text,
    confirmed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cafe_subscriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'cancelled'::text])))
);

CREATE TABLE public.cafe_tags (
    cafe_id uuid NOT NULL,
    tag_id uuid NOT NULL
);

CREATE TABLE public.cafe_unlocks (
    user_id uuid NOT NULL,
    cafe_id uuid NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.cafes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    city_id uuid NOT NULL,
    area text,
    address text,
    lat double precision,
    lng double precision,
    price_range smallint DEFAULT 2 NOT NULL,
    opening_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    my_rating numeric(2,1),
    short_review text,
    is_featured boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    visited_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    menu_url text,
    instagram text,
    scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    amenities jsonb DEFAULT '{}'::jsonb NOT NULL,
    contributor_name text,
    contributor_instagram text,
    contributor_id uuid,
    announced_at timestamp with time zone,
    CONSTRAINT cafes_my_rating_check CHECK (((my_rating >= (0)::numeric) AND (my_rating <= (5)::numeric))),
    CONSTRAINT cafes_price_range_check CHECK (((price_range >= 1) AND (price_range <= 5)))
);

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    province text DEFAULT 'Jawa Tengah'::text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.contact_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    body text NOT NULL,
    page text,
    user_id uuid,
    ip_hash text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contact_messages_body_check CHECK (((char_length(btrim(body)) >= 10) AND (char_length(btrim(body)) <= 2000))),
    CONSTRAINT contact_messages_email_check CHECK (((email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text) AND (char_length(email) <= 160))),
    CONSTRAINT contact_messages_name_check CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 80))),
    CONSTRAINT contact_messages_topic_check CHECK ((topic = ANY (ARRAY['saran'::text, 'kafe_saya'::text, 'koreksi'::text, 'kerja_sama'::text, 'lainnya'::text, 'bug'::text, 'platform'::text, 'kritik'::text])))
);

CREATE TABLE public.content_translations (
    entity text NOT NULL,
    entity_id uuid NOT NULL,
    field text NOT NULL,
    lang text NOT NULL,
    source_hash text NOT NULL,
    text text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_translations_lang_check CHECK ((lang = 'en'::text))
);

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    kind text DEFAULT 'kerja_bareng'::text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    city_id uuid,
    cafe_id uuid,
    venue text,
    description text,
    cover_url text,
    register_url text,
    quota integer,
    price text,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT events_quota_check CHECK (((quota IS NULL) OR (quota > 0)))
);

CREATE TABLE public.favorites (
    user_id uuid NOT NULL,
    cafe_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    name text NOT NULL,
    price integer,
    photo_url text,
    note text,
    is_must_try boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.notification_dismissals (
    user_id uuid NOT NULL,
    notification_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    kind text NOT NULL,
    title text NOT NULL,
    body text,
    url text,
    cafe_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_kind_check CHECK ((kind = ANY (ARRAY['new_cafe'::text, 'activity'::text, 'owner_message'::text])))
);

CREATE TABLE public.owner_messages (
    id bigint NOT NULL,
    cafe_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    from_admin boolean DEFAULT false NOT NULL,
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT owner_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000)))
);

CREATE SEQUENCE public.owner_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.owner_messages_id_seq OWNED BY public.owner_messages.id;

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    order_id text NOT NULL,
    plan text NOT NULL,
    amount integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    method text DEFAULT 'midtrans'::text NOT NULL,
    CONSTRAINT payments_method_check CHECK ((method = ANY (ARRAY['midtrans'::text, 'manual'::text]))),
    CONSTRAINT payments_plan_check CHECK ((plan = ANY (ARRAY['monthly'::text, 'yearly'::text])))
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text,
    email text,
    avatar_url text,
    role text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bio text,
    instagram text,
    username text,
    notified_level integer DEFAULT 0 NOT NULL,
    notify_new_cafe boolean DEFAULT true NOT NULL,
    notify_activity boolean DEFAULT true NOT NULL,
    notif_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    notif_cleared_at timestamp with time zone,
    CONSTRAINT profiles_bio_len CHECK (((bio IS NULL) OR (char_length(bio) <= 300))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text]))),
    CONSTRAINT profiles_username_format CHECK (((username IS NULL) OR (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'::text)))
);

CREATE TABLE public.push_subscriptions (
    endpoint text NOT NULL,
    user_id uuid NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    midtrans_order_id text,
    amount integer NOT NULL,
    reminder_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_plan_check CHECK ((plan = ANY (ARRAY['monthly'::text, 'yearly'::text, 'trial'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text])))
);

CREATE TABLE public.supporters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    external_id text,
    name text NOT NULL,
    message text,
    amount integer,
    email text,
    is_hidden boolean DEFAULT false NOT NULL,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supporters_source_check CHECK ((source = ANY (ARRAY['saweria'::text, 'trakteer'::text, 'manual'::text])))
);

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    CONSTRAINT tags_type_check CHECK ((type = ANY (ARRAY['vibe'::text, 'facility'::text])))
);

CREATE TABLE public.user_visits (
    user_id uuid NOT NULL,
    cafe_id uuid NOT NULL,
    visited_at date DEFAULT CURRENT_DATE NOT NULL
);

CREATE TABLE public.wallet_transactions (
    id bigint NOT NULL,
    cafe_id uuid NOT NULL,
    type text NOT NULL,
    amount bigint NOT NULL,
    balance_after bigint NOT NULL,
    ref_id text,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_transactions_type_check CHECK ((type = ANY (ARRAY['topup'::text, 'bonus'::text, 'click_charge'::text, 'impression_charge'::text, 'refund'::text, 'adjustment'::text])))
);

ALTER TABLE public.wallet_transactions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE ONLY public.cafe_events ALTER COLUMN id SET DEFAULT nextval('public.cafe_events_id_seq'::regclass);

ALTER TABLE ONLY public.owner_messages ALTER COLUMN id SET DEFAULT nextval('public.owner_messages_id_seq'::regclass);

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_clicks
    ADD CONSTRAINT ad_clicks_impression_id_key UNIQUE (impression_id);

ALTER TABLE ONLY public.ad_clicks
    ADD CONSTRAINT ad_clicks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_placements
    ADD CONSTRAINT ad_placements_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.ad_targets
    ADD CONSTRAINT ad_targets_campaign_id_target_type_target_value_key UNIQUE (campaign_id, target_type, target_value);

ALTER TABLE ONLY public.ad_targets
    ADD CONSTRAINT ad_targets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_wallets
    ADD CONSTRAINT ad_wallets_pkey PRIMARY KEY (cafe_id);

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.article_likes
    ADD CONSTRAINT article_likes_pkey PRIMARY KEY (article_id, user_id);

ALTER TABLE ONLY public.article_saves
    ADD CONSTRAINT article_saves_pkey PRIMARY KEY (article_id, user_id);

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.cafe_comments
    ADD CONSTRAINT cafe_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafe_details
    ADD CONSTRAINT cafe_details_pkey PRIMARY KEY (cafe_id);

ALTER TABLE ONLY public.cafe_events
    ADD CONSTRAINT cafe_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafe_owners
    ADD CONSTRAINT cafe_owners_cafe_id_user_id_key UNIQUE (cafe_id, user_id);

ALTER TABLE ONLY public.cafe_owners
    ADD CONSTRAINT cafe_owners_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafe_photos
    ADD CONSTRAINT cafe_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafe_plans
    ADD CONSTRAINT cafe_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafe_quality_scores
    ADD CONSTRAINT cafe_quality_scores_pkey PRIMARY KEY (cafe_id);

ALTER TABLE ONLY public.cafe_reports
    ADD CONSTRAINT cafe_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafe_submissions
    ADD CONSTRAINT cafe_submissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafe_subscriptions
    ADD CONSTRAINT cafe_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafe_tags
    ADD CONSTRAINT cafe_tags_pkey PRIMARY KEY (cafe_id, tag_id);

ALTER TABLE ONLY public.cafe_unlocks
    ADD CONSTRAINT cafe_unlocks_pkey PRIMARY KEY (user_id, cafe_id);

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_translations
    ADD CONSTRAINT content_translations_pkey PRIMARY KEY (entity, entity_id, field, lang);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, cafe_id);

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_dismissals
    ADD CONSTRAINT notification_dismissals_pkey PRIMARY KEY (user_id, notification_id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.owner_messages
    ADD CONSTRAINT owner_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_key UNIQUE (order_id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (endpoint);

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_midtrans_order_id_key UNIQUE (midtrans_order_id);

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.supporters
    ADD CONSTRAINT supporters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_visits
    ADD CONSTRAINT user_visits_pkey PRIMARY KEY (user_id, cafe_id);

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);

CREATE INDEX ad_campaigns_cafe_id_status_idx ON public.ad_campaigns USING btree (cafe_id, status);

CREATE INDEX ad_clicks_cafe_id_created_at_idx ON public.ad_clicks USING btree (cafe_id, created_at);

CREATE INDEX ad_impressions_cafe_id_created_at_idx ON public.ad_impressions USING btree (cafe_id, created_at);

CREATE INDEX ad_impressions_campaign_id_created_at_idx ON public.ad_impressions USING btree (campaign_id, created_at);

CREATE INDEX ad_targets_target_type_lower_idx ON public.ad_targets USING btree (target_type, lower(target_value)) WHERE is_active;

CREATE INDEX article_saves_user_idx ON public.article_saves USING btree (user_id, created_at DESC);

CREATE INDEX article_views_idx ON public.article_views USING btree (article_id, viewer_hash, created_at DESC);

CREATE INDEX articles_pub_idx ON public.articles USING btree (is_published, published_at DESC);

CREATE INDEX cafe_comments_cafe_idx ON public.cafe_comments USING btree (cafe_id, created_at);

CREATE INDEX cafe_comments_recent_idx ON public.cafe_comments USING btree (created_at DESC);

CREATE INDEX cafe_comments_user_idx ON public.cafe_comments USING btree (user_id, created_at DESC);

CREATE INDEX cafe_events_cafe_time_idx ON public.cafe_events USING btree (cafe_id, created_at DESC);

CREATE INDEX cafe_events_time_idx ON public.cafe_events USING btree (created_at DESC);

CREATE INDEX cafe_owners_user_id_idx ON public.cafe_owners USING btree (user_id);

CREATE INDEX cafe_photos_cafe_idx ON public.cafe_photos USING btree (cafe_id);

CREATE INDEX cafe_photos_sort_idx ON public.cafe_photos USING btree (cafe_id, sort_order);

CREATE INDEX cafe_reports_cafe_idx ON public.cafe_reports USING btree (cafe_id, created_at DESC);

CREATE INDEX cafe_reports_recent_idx ON public.cafe_reports USING btree (created_at DESC);

CREATE INDEX cafe_reports_user_idx ON public.cafe_reports USING btree (user_id, created_at DESC);

CREATE INDEX cafe_submissions_status_idx ON public.cafe_submissions USING btree (status, created_at DESC);

CREATE INDEX cafe_submissions_user_idx ON public.cafe_submissions USING btree (user_id, created_at DESC);

CREATE INDEX cafe_subscriptions_cafe_id_status_ends_at_idx ON public.cafe_subscriptions USING btree (cafe_id, status, ends_at);

CREATE INDEX cafe_tags_tag_idx ON public.cafe_tags USING btree (tag_id);

CREATE INDEX cafe_unlocks_month_idx ON public.cafe_unlocks USING btree (user_id, unlocked_at);

CREATE INDEX cafes_city_idx ON public.cafes USING btree (city_id);

CREATE INDEX cafes_created_idx ON public.cafes USING btree (created_at DESC);

CREATE INDEX cafes_featured_idx ON public.cafes USING btree (is_featured) WHERE is_featured;

CREATE INDEX cafes_published_rating_idx ON public.cafes USING btree (is_published, my_rating DESC);

CREATE INDEX contact_messages_ip_idx ON public.contact_messages USING btree (ip_hash, created_at DESC);

CREATE INDEX contact_messages_recent_idx ON public.contact_messages USING btree (created_at DESC);

CREATE INDEX content_translations_entity_id_idx ON public.content_translations USING btree (entity_id, lang);

CREATE INDEX events_starts_idx ON public.events USING btree (starts_at);

CREATE INDEX favorites_user_idx ON public.favorites USING btree (user_id, created_at DESC);

CREATE INDEX menu_items_cafe_idx ON public.menu_items USING btree (cafe_id);

CREATE INDEX menu_items_sort_idx ON public.menu_items USING btree (cafe_id, sort_order);

CREATE INDEX notifications_all_idx ON public.notifications USING btree (created_at DESC) WHERE (user_id IS NULL);

CREATE INDEX notifications_cafe_idx ON public.notifications USING btree (cafe_id, kind, created_at DESC);

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);

CREATE INDEX owner_messages_cafe_idx ON public.owner_messages USING btree (cafe_id, created_at);

CREATE INDEX payments_manual_pending_idx ON public.payments USING btree (created_at DESC) WHERE ((method = 'manual'::text) AND (status = 'pending'::text));

CREATE INDEX payments_status_idx ON public.payments USING btree (status, created_at DESC);

CREATE INDEX payments_user_idx ON public.payments USING btree (user_id, created_at DESC);

CREATE INDEX profiles_role_idx ON public.profiles USING btree (role) WHERE (role = 'admin'::text);

CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);

CREATE INDEX subscriptions_active_idx ON public.subscriptions USING btree (status, end_date);

CREATE INDEX subscriptions_user_idx ON public.subscriptions USING btree (user_id, end_date DESC);

CREATE INDEX supporters_created_idx ON public.supporters USING btree (created_at DESC);

CREATE UNIQUE INDEX supporters_external_uq ON public.supporters USING btree (source, external_id) WHERE (external_id IS NOT NULL);

CREATE INDEX user_visits_user_idx ON public.user_visits USING btree (user_id);

CREATE INDEX wallet_transactions_cafe_id_created_at_idx ON public.wallet_transactions USING btree (cafe_id, created_at DESC);

CREATE TRIGGER article_like_count_sync AFTER INSERT OR DELETE ON public.article_likes FOR EACH ROW EXECUTE FUNCTION public.article_like_count_sync();

CREATE TRIGGER cafe_reports_limit BEFORE INSERT ON public.cafe_reports FOR EACH ROW EXECUTE FUNCTION public.cafe_reports_limit();

CREATE TRIGGER cafes_touch BEFORE UPDATE ON public.cafes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER events_touch BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER profiles_protect_role BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_role();

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_clicks
    ADD CONSTRAINT ad_clicks_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_clicks
    ADD CONSTRAINT ad_clicks_impression_id_fkey FOREIGN KEY (impression_id) REFERENCES public.ad_impressions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_placement_fkey FOREIGN KEY (placement) REFERENCES public.ad_placements(code);

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.ad_targets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_targets
    ADD CONSTRAINT ad_targets_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_wallets
    ADD CONSTRAINT ad_wallets_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_likes
    ADD CONSTRAINT article_likes_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_likes
    ADD CONSTRAINT article_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_saves
    ADD CONSTRAINT article_saves_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_saves
    ADD CONSTRAINT article_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.article_views
    ADD CONSTRAINT article_views_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.cafe_comments
    ADD CONSTRAINT cafe_comments_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_comments
    ADD CONSTRAINT cafe_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.cafe_comments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_comments
    ADD CONSTRAINT cafe_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_details
    ADD CONSTRAINT cafe_details_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_events
    ADD CONSTRAINT cafe_events_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_owners
    ADD CONSTRAINT cafe_owners_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_owners
    ADD CONSTRAINT cafe_owners_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_photos
    ADD CONSTRAINT cafe_photos_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_quality_scores
    ADD CONSTRAINT cafe_quality_scores_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_reports
    ADD CONSTRAINT cafe_reports_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_reports
    ADD CONSTRAINT cafe_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_submissions
    ADD CONSTRAINT cafe_submissions_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.cafe_submissions
    ADD CONSTRAINT cafe_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_subscriptions
    ADD CONSTRAINT cafe_subscriptions_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_subscriptions
    ADD CONSTRAINT cafe_subscriptions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.cafe_subscriptions
    ADD CONSTRAINT cafe_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.cafe_plans(id);

ALTER TABLE ONLY public.cafe_tags
    ADD CONSTRAINT cafe_tags_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_tags
    ADD CONSTRAINT cafe_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_unlocks
    ADD CONSTRAINT cafe_unlocks_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafe_unlocks
    ADD CONSTRAINT cafe_unlocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id);

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_contributor_id_fkey FOREIGN KEY (contributor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_dismissals
    ADD CONSTRAINT notification_dismissals_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_dismissals
    ADD CONSTRAINT notification_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.owner_messages
    ADD CONSTRAINT owner_messages_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.owner_messages
    ADD CONSTRAINT owner_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_visits
    ADD CONSTRAINT user_visits_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_visits
    ADD CONSTRAINT user_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.ad_wallets(cafe_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_targets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_wallets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY article_likes_own_delete ON public.article_likes FOR DELETE USING ((user_id = auth.uid()));

CREATE POLICY article_likes_own_insert ON public.article_likes FOR INSERT WITH CHECK ((user_id = auth.uid()));

CREATE POLICY article_likes_own_read ON public.article_likes FOR SELECT USING (((user_id = auth.uid()) OR public.is_admin()));

ALTER TABLE public.article_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY article_saves_admin_read ON public.article_saves FOR SELECT USING (public.is_admin());

CREATE POLICY article_saves_own ON public.article_saves USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY articles_admin ON public.articles USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY articles_read ON public.articles FOR SELECT USING ((is_published OR public.is_admin()));

ALTER TABLE public.cafe_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafe_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cafe_details admin delete" ON public.cafe_details FOR DELETE USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafe_details admin insert" ON public.cafe_details FOR INSERT WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafe_details admin update" ON public.cafe_details FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

ALTER TABLE public.cafe_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafe_owners ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafe_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cafe_photos admin delete" ON public.cafe_photos FOR DELETE USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafe_photos admin insert" ON public.cafe_photos FOR INSERT WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafe_photos admin update" ON public.cafe_photos FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

ALTER TABLE public.cafe_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafe_quality_scores ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafe_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafe_submissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafe_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafe_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cafe_tags admin delete" ON public.cafe_tags FOR DELETE USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafe_tags admin insert" ON public.cafe_tags FOR INSERT WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafe_tags admin update" ON public.cafe_tags FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

ALTER TABLE public.cafe_unlocks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cafes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cafes admin delete" ON public.cafes FOR DELETE USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafes admin insert" ON public.cafes FOR INSERT WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafes admin update" ON public.cafes FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cafes read" ON public.cafes FOR SELECT USING ((is_published OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "cafetags read" ON public.cafe_tags FOR SELECT USING (true);

CREATE POLICY camp_owner_all ON public.ad_campaigns USING ((public.is_cafe_owner(cafe_id) OR public.is_admin())) WITH CHECK ((public.is_cafe_owner(cafe_id) OR public.is_admin()));

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cities admin delete" ON public.cities FOR DELETE USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cities admin insert" ON public.cities FOR INSERT WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cities admin update" ON public.cities FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "cities read" ON public.cities FOR SELECT USING (true);

CREATE POLICY click_owner_read ON public.ad_clicks FOR SELECT USING ((public.is_cafe_owner(cafe_id) OR public.is_admin()));

CREATE POLICY "comments admin update" ON public.cafe_comments FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "comments delete" ON public.cafe_comments FOR DELETE USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "comments insert own" ON public.cafe_comments FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (NOT is_hidden) AND (EXISTS ( SELECT 1
   FROM public.cafes c
  WHERE ((c.id = cafe_comments.cafe_id) AND c.is_published)))));

CREATE POLICY "comments read" ON public.cafe_comments FOR SELECT USING (((NOT is_hidden) OR (user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "contact admin delete" ON public.contact_messages FOR DELETE USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "contact admin read" ON public.contact_messages FOR SELECT USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "contact admin update" ON public.contact_messages FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "details read" ON public.cafe_details FOR SELECT USING ((( SELECT public.free_mode() AS free_mode) OR ( SELECT public.is_admin() AS is_admin) OR ( SELECT public.is_premium() AS is_premium) OR (EXISTS ( SELECT 1
   FROM public.cafe_unlocks u
  WHERE ((u.user_id = ( SELECT auth.uid() AS uid)) AND (u.cafe_id = cafe_details.cafe_id))))));

CREATE POLICY "dismissals own" ON public.notification_dismissals USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events admin" ON public.events USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "events read" ON public.events FOR SELECT USING ((( SELECT public.is_admin() AS is_admin) OR (is_published AND (EXISTS ( SELECT 1
   FROM public.app_settings s
  WHERE ((s.key = 'events_public'::text) AND (s.value = 'true'::text)))))));

CREATE POLICY "fav own" ON public.favorites USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY imp_owner_read ON public.ad_impressions FOR SELECT USING ((public.is_cafe_owner(cafe_id) OR public.is_admin()));

CREATE POLICY "menu read" ON public.menu_items FOR SELECT USING ((( SELECT public.free_mode() AS free_mode) OR ( SELECT public.is_admin() AS is_admin) OR ( SELECT public.is_premium() AS is_premium) OR (EXISTS ( SELECT 1
   FROM public.cafe_unlocks u
  WHERE ((u.user_id = ( SELECT auth.uid() AS uid)) AND (u.cafe_id = menu_items.cafe_id))))));

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_items admin delete" ON public.menu_items FOR DELETE USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "menu_items admin insert" ON public.menu_items FOR INSERT WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "menu_items admin update" ON public.menu_items FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

ALTER TABLE public.notification_dismissals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications read" ON public.notifications FOR SELECT TO authenticated USING (((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid))));

ALTER TABLE public.owner_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_msg_admin_delete ON public.owner_messages FOR DELETE USING (public.is_admin());

CREATE POLICY owner_msg_read ON public.owner_messages FOR SELECT USING ((public.is_admin() OR public.is_cafe_claimant(cafe_id)));

CREATE POLICY owner_msg_send_admin ON public.owner_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND from_admin AND (read_at IS NULL) AND public.is_admin()));

CREATE POLICY owner_msg_send_owner ON public.owner_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (NOT from_admin) AND (read_at IS NULL) AND public.is_cafe_claimant(cafe_id)));

CREATE POLICY owners_admin_all ON public.cafe_owners USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY owners_self_claim ON public.cafe_owners FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (verified_at IS NULL)));

CREATE POLICY owners_self_read ON public.cafe_owners FOR SELECT USING (((user_id = auth.uid()) OR public.is_admin()));

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments read" ON public.payments FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "photos read" ON public.cafe_photos FOR SELECT USING (true);

CREATE POLICY placements_admin_all ON public.ad_placements USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY placements_public_read ON public.ad_placements FOR SELECT USING (true);

CREATE POLICY plans_admin_all ON public.cafe_plans USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY plans_public_read ON public.cafe_plans FOR SELECT USING (true);

CREATE POLICY "profile read" ON public.profiles FOR SELECT USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "profile update" ON public.profiles FOR UPDATE USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin))) WITH CHECK (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push own read" ON public.push_subscriptions FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY qs_admin_all ON public.cafe_quality_scores USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY qs_owner_read ON public.cafe_quality_scores FOR SELECT USING ((public.is_cafe_owner(cafe_id) OR public.is_admin()));

CREATE POLICY "reports delete" ON public.cafe_reports FOR DELETE USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "reports insert own" ON public.cafe_reports FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.cafes c
  WHERE ((c.id = cafe_reports.cafe_id) AND c.is_published)))));

CREATE POLICY "reports read own" ON public.cafe_reports FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "settings admin" ON public.app_settings USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "settings read" ON public.app_settings FOR SELECT USING (true);

CREATE POLICY "submissions admin update" ON public.cafe_submissions FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "submissions delete own" ON public.cafe_submissions FOR DELETE USING ((((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "submissions insert own" ON public.cafe_submissions FOR INSERT WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text) AND (cafe_id IS NULL) AND (admin_note IS NULL)));

CREATE POLICY "submissions read" ON public.cafe_submissions FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "subs read" ON public.subscriptions FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY subs_admin_all ON public.cafe_subscriptions USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY subs_owner_read ON public.cafe_subscriptions FOR SELECT USING ((public.is_cafe_owner(cafe_id) OR public.is_admin()));

CREATE POLICY subs_owner_request ON public.cafe_subscriptions FOR INSERT WITH CHECK ((public.is_cafe_owner(cafe_id) AND (status = 'pending'::text) AND (confirmed_by IS NULL)));

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.supporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supporters admin" ON public.supporters USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags admin delete" ON public.tags FOR DELETE USING (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "tags admin insert" ON public.tags FOR INSERT WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "tags admin update" ON public.tags FOR UPDATE USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));

CREATE POLICY "tags read" ON public.tags FOR SELECT USING (true);

CREATE POLICY targets_owner_all ON public.ad_targets USING ((EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_targets.campaign_id) AND (public.is_cafe_owner(c.cafe_id) OR public.is_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ad_campaigns c
  WHERE ((c.id = ad_targets.campaign_id) AND (public.is_cafe_owner(c.cafe_id) OR public.is_admin())))));

CREATE POLICY "unlock read" ON public.cafe_unlocks FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

ALTER TABLE public.user_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visits own" ON public.user_visits USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY wallet_owner_read ON public.ad_wallets FOR SELECT USING ((public.is_cafe_owner(cafe_id) OR public.is_admin()));

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wtx_owner_read ON public.wallet_transactions FOR SELECT USING ((public.is_cafe_owner(cafe_id) OR public.is_admin()));

