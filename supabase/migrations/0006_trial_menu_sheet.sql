-- =====================================================================
--  0006 — Trial gratis, link menu & Instagram kafe, sinkron Google Sheets
--  Aman dijalankan ulang.
-- =====================================================================

-- 1. Kolom baru di kafe
alter table public.cafes add column if not exists menu_url  text;   -- link buku menu dari kafe (publik)
alter table public.cafes add column if not exists instagram text;   -- username tanpa @

-- 2. Paket "trial" untuk langganan
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('monthly', 'yearly', 'trial'));

-- 3. Pengaturan baru
insert into public.app_settings (key, value) values
  ('trial_days', '7'),
  ('sheet_url', ''),
  ('sheet_last_sync', '')
on conflict (key) do nothing;

-- 4. Pendaftar baru otomatis dapat trial sesuai trial_days (0 = mati)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
  if coalesce(v_days, 0) > 0 then
    insert into public.subscriptions (user_id, plan, status, start_date, end_date, amount)
    values (new.id, 'trial', 'active', now(), now() + make_interval(days => v_days), 0);
  end if;
  return new;
end $$;
