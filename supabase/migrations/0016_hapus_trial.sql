-- =====================================================================
--  0016: Hapus trial gratis (semua konten sekarang gratis)
--  Jalankan di Supabase: SQL Editor, paste seluruh file, Run.
--  Aman dijalankan ulang.
-- =====================================================================

-- 1. Pendaftar baru tidak lagi dapat trial selama mode gratis aktif
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
  if coalesce(v_days, 0) > 0 and not public.free_mode() then
    insert into public.subscriptions (user_id, plan, status, start_date, end_date, amount)
    values (new.id, 'trial', 'active', now(), now() + make_interval(days => v_days), 0);
  end if;
  return new;
end $$;

-- 2. Matikan trial di pengaturan (bisa dinyalakan lagi di Admin > Pengaturan kalau kembali ke mode langganan)
update public.app_settings set value = '0' where key = 'trial_days';

-- 3. Hapus semua trial yang sudah ada. Langganan berbayar dan akses yang diberikan admin tidak tersentuh.
delete from public.subscriptions where plan = 'trial';
