-- =====================================================================
--  0005 — Pembayaran manual lewat QRIS (mis. DANA Bisnis) + konfirmasi WhatsApp
--  Aman dijalankan ulang.
-- =====================================================================
alter table public.payments add column if not exists method text not null default 'midtrans';
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('midtrans', 'manual'));
create index if not exists payments_manual_pending_idx on public.payments (created_at desc) where method = 'manual' and status = 'pending';

insert into public.app_settings (key, value) values
  ('manual_payment_enabled', 'true'),
  ('whatsapp_number', '6281339646353'),
  ('qris_image_url', ''),
  ('qris_name', 'DANA Bisnis')
on conflict (key) do nothing;

insert into public.app_settings (key, value) values ('qris_merchant_name', 'Sinar Sunrise')
on conflict (key) do nothing;
-- QRIS bawaan ada di /qris.png (folder public). Kosongkan baris qris_image_url supaya memakai gambar itu.
update public.app_settings set value = '/qris.png' where key = 'qris_image_url' and value = '';
