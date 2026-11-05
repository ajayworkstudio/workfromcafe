-- 0030: Pengetatan akses database dan storage.
-- Aman dijalankan ulang.

-- 1. Bucket foto: hanya gambar, maksimal 5 MB (0017 belum berlaku di database).
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id = 'cafe-photos';

-- 2. Isi bucket tidak bisa didaftar orang lain. Foto tetap tampil lewat link publiknya
--    (bucket publik tidak memeriksa kebijakan ini). Pengguna tetap bisa menghapus
--    avatar dan foto kiriman miliknya sendiri.
drop policy if exists "cafe photos public read" on storage.objects;
drop policy if exists "cafe photos scoped read" on storage.objects;
create policy "cafe photos scoped read" on storage.objects for select using (
  bucket_id = 'cafe-photos' and (
    public.is_admin()
    or ((storage.foldername(name))[1] in ('avatars', 'submissions')
        and (storage.foldername(name))[2] = (select auth.uid())::text)
  )
);

-- 3. Pengaturan: dari luar hanya kunci yang memang tampil di situs.
--    Server membaca semua kunci dengan service role (src/lib/settings.ts).
drop policy if exists "settings read" on public.app_settings;
create policy "settings read" on public.app_settings for select using (
  key = any (array[
    'free_mode', 'events_public', 'community_url', 'support_url', 'whatsapp_number', 'featured_author',
    'price_monthly', 'price_yearly', 'trial_days', 'free_unlock_limit_per_month', 'manual_payment_enabled',
    'qris_image_url', 'qris_name', 'qris_merchant_name'
  ])
  or (select public.is_admin())
);

-- 4. Fungsi yang tidak perlu dipanggil lewat API.
--    Fungsi trigger tetap jalan sebagai trigger tanpa hak EXECUTE.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.article_like_count_sync() from public, anon, authenticated;
revoke execute on function public.cafe_reports_limit() from public, anon, authenticated;
-- Hanya untuk yang sudah login (di dalamnya sudah ada cek admin / auth.uid()).
revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.admin_usage_counts() from public, anon;
revoke execute on function public.notif_unread_count() from public, anon;
revoke execute on function public.free_unlocks_left() from public, anon;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_usage_counts() to authenticated;
grant execute on function public.notif_unread_count() to authenticated;
grant execute on function public.free_unlocks_left() to authenticated;

-- 5. search_path tetap supaya fungsi tidak bisa dibelokkan ke skema lain.
alter function public.touch_updated_at() set search_path = public;
