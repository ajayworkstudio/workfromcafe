-- =====================================================================
--  0010 — Perluas cakupan ke kota-kota besar Pulau Jawa
--  Jalankan di Supabase: SQL Editor → paste seluruh file → Run.
--  Aman dijalankan ulang. Kota baru berstatus nonaktif dan otomatis
--  aktif begitu ada kafe yang tayang di kota tersebut.
-- =====================================================================

insert into public.cities (name, slug, province, lat, lng, is_active) values
  ('Jakarta',    'jakarta',    'DKI Jakarta',   -6.2088, 106.8456, false),
  ('Tangerang',  'tangerang',  'Banten',        -6.1783, 106.6319, false),
  ('Tangerang Selatan', 'tangerang-selatan', 'Banten', -6.2886, 106.7179, false),
  ('Serang',     'serang',     'Banten',        -6.1201, 106.1503, false),
  ('Bogor',      'bogor',      'Jawa Barat',    -6.5971, 106.8060, false),
  ('Depok',      'depok',      'Jawa Barat',    -6.4025, 106.7942, false),
  ('Bekasi',     'bekasi',     'Jawa Barat',    -6.2383, 106.9756, false),
  ('Bandung',    'bandung',    'Jawa Barat',    -6.9175, 107.6191, false),
  ('Cirebon',    'cirebon',    'Jawa Barat',    -6.7320, 108.5523, false),
  ('Tasikmalaya','tasikmalaya','Jawa Barat',    -7.3274, 108.2207, false),
  ('Yogyakarta', 'yogyakarta', 'DI Yogyakarta', -7.7956, 110.3695, false),
  ('Surabaya',   'surabaya',   'Jawa Timur',    -7.2575, 112.7521, false),
  ('Malang',     'malang',     'Jawa Timur',    -7.9666, 112.6326, false),
  ('Sidoarjo',   'sidoarjo',   'Jawa Timur',    -7.4478, 112.7183, false),
  ('Kediri',     'kediri',     'Jawa Timur',    -7.8480, 112.0178, false),
  ('Jember',     'jember',     'Jawa Timur',    -8.1724, 113.7000, false)
on conflict (slug) do nothing;

