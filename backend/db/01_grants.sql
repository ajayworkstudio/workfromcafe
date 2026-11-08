-- Hak akses peran untuk API Go. Muat setelah schema.sql. Aman dijalankan berulang.
--
-- API Go menjalankan query publik sebagai peran anon (SET LOCAL ROLE anon), sama seperti pengunjung
-- yang belum login di Supabase, jadi policy RLS di schema.sql tetap menyaring datanya.
-- Di Supabase anon/authenticated punya semua hak tabel; di sini hanya SELECT. Hak menulis
-- ditambahkan per tabel di step 7, saat fitur tulisnya dipindah.

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

-- Fungsi yang di Supabase tidak bisa dipanggil anon (dan beberapa juga tidak oleh authenticated).
revoke execute on function public.admin_wallet_adjust(uuid, bigint, text, text) from public, anon;
revoke execute on function public.cafe_stats(uuid, integer) from public, anon;
revoke execute on function public.cafes_stats_overview(integer) from public, anon;
revoke execute on function public.is_cafe_claimant(uuid) from public, anon;
revoke execute on function public.is_cafe_owner(uuid) from public, anon;
revoke execute on function public.owner_messages_mark_read(uuid) from public, anon;
grant execute on function public.admin_wallet_adjust(uuid, bigint, text, text) to authenticated;
grant execute on function public.cafe_stats(uuid, integer) to authenticated;
grant execute on function public.cafes_stats_overview(integer) to authenticated;
grant execute on function public.is_cafe_claimant(uuid) to authenticated;
grant execute on function public.is_cafe_owner(uuid) to authenticated;
grant execute on function public.owner_messages_mark_read(uuid) to authenticated;
revoke execute on function public.log_article_view(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.log_cafe_event(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.run_ad_auction(text, text, text) from public, anon, authenticated;

-- Peran login API boleh berganti ke anon/authenticated, tapi tidak memakai haknya secara langsung.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'wfc_api') then
    alter role wfc_api noinherit;
    grant anon, authenticated to wfc_api with inherit false, set true;
  end if;
end $$;
