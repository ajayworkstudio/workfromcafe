-- Pengaturan spasi teks per artikel. Default "normal" supaya artikel lama tidak berubah.
alter table public.articles
  add column if not exists line_spacing text not null default 'normal'
    check (line_spacing in ('rapat', 'normal', 'lega')),
  add column if not exists paragraph_spacing text not null default 'normal'
    check (paragraph_spacing in ('rapat', 'normal', 'lega'));
