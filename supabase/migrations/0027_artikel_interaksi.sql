-- 0027: suka, simpan, dan jumlah dilihat per artikel. Jalankan setelah 0026. Aman dijalankan ulang.

alter table public.articles add column if not exists view_count integer not null default 0;
alter table public.articles add column if not exists like_count integer not null default 0;

create table if not exists public.article_likes (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
alter table public.article_likes enable row level security;
drop policy if exists "article_likes_own_read" on public.article_likes;
create policy "article_likes_own_read" on public.article_likes for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "article_likes_own_insert" on public.article_likes;
create policy "article_likes_own_insert" on public.article_likes for insert with check (user_id = auth.uid());
drop policy if exists "article_likes_own_delete" on public.article_likes;
create policy "article_likes_own_delete" on public.article_likes for delete using (user_id = auth.uid());

create table if not exists public.article_saves (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
create index if not exists article_saves_user_idx on public.article_saves (user_id, created_at desc);
alter table public.article_saves enable row level security;
drop policy if exists "article_saves_own" on public.article_saves;
create policy "article_saves_own" on public.article_saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "article_saves_admin_read" on public.article_saves;
create policy "article_saves_admin_read" on public.article_saves for select using (public.is_admin());

-- like_count dijaga trigger supaya angka publik tidak perlu membaca siapa saja yang menyukai
create or replace function public.article_like_count_sync()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.articles set like_count = like_count + 1 where id = new.article_id;
  else
    update public.articles set like_count = greatest(0, like_count - 1) where id = old.article_id;
  end if;
  return null;
end;
$$;
drop trigger if exists article_like_count_sync on public.article_likes;
create trigger article_like_count_sync after insert or delete on public.article_likes
  for each row execute function public.article_like_count_sync();

-- Jumlah dilihat: satu pengunjung dihitung sekali per 30 menit per artikel. Dipanggil server dengan service role.
create table if not exists public.article_views (
  article_id  uuid not null references public.articles(id) on delete cascade,
  viewer_hash text not null,
  created_at  timestamptz not null default now()
);
create index if not exists article_views_idx on public.article_views (article_id, viewer_hash, created_at desc);
alter table public.article_views enable row level security;

create or replace function public.log_article_view(p_article_id uuid, p_viewer text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.articles where id = p_article_id and is_published) then return; end if;
  if p_user_id is not null and exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then return; end if;
  if exists (select 1 from public.article_views where article_id = p_article_id and viewer_hash = p_viewer
             and created_at > now() - interval '30 minutes') then return; end if;
  insert into public.article_views (article_id, viewer_hash) values (p_article_id, left(p_viewer, 64));
  update public.articles set view_count = view_count + 1 where id = p_article_id;
end;
$$;
revoke all on function public.log_article_view(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.log_article_view(uuid,text,uuid) to service_role;
