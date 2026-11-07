-- Cache terjemahan konten (ulasan kafe, menu, artikel) untuk tampilan bahasa Inggris.
-- Diisi server lewat service role; tidak ada policy, jadi anon/authenticated tidak bisa membaca atau menulis.
create table if not exists public.content_translations (
  entity      text not null,          -- cafe | cafe_detail | menu_item | article
  entity_id   uuid not null,
  field       text not null,          -- short_review, full_review, note:wifi, title, body, ...
  lang        text not null check (lang in ('en')),
  source_hash text not null,          -- hash teks asli; beda hash = diterjemahkan ulang
  text        text not null,
  updated_at  timestamptz not null default now(),
  primary key (entity, entity_id, field, lang)
);
create index if not exists content_translations_entity_id_idx on public.content_translations (entity_id, lang);

alter table public.content_translations enable row level security;
revoke all on public.content_translations from anon, authenticated;
