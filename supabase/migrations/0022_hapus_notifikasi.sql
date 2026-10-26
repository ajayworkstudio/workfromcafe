-- =====================================================================
--  0022: Pengguna bisa menghapus notifikasi dari kotak notifikasinya
--  Notifikasi umum (kafe baru) dipakai bersama semua pengguna, jadi "hapus" dicatat per pengguna:
--  satu per satu lewat notification_dismissals, atau semuanya sekaligus lewat profiles.notif_cleared_at.
--  Aman dijalankan ulang.
-- =====================================================================

alter table public.profiles add column if not exists notif_cleared_at timestamptz;

create table if not exists public.notification_dismissals (
  user_id         uuid not null references auth.users(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (user_id, notification_id)
);
alter table public.notification_dismissals enable row level security;
drop policy if exists "dismissals own" on public.notification_dismissals;
create policy "dismissals own" on public.notification_dismissals for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Titik merah di lonceng tidak menghitung notifikasi yang sudah dihapus
create or replace function public.notif_unread_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications n
  join public.profiles p on p.id = auth.uid()
  where (n.user_id is null or n.user_id = p.id)
    and n.created_at > p.notif_seen_at
    and (p.notif_cleared_at is null or n.created_at > p.notif_cleared_at)
    and not exists (select 1 from public.notification_dismissals d where d.user_id = p.id and d.notification_id = n.id);
$$;
grant execute on function public.notif_unread_count() to authenticated;
