-- =====================================================================
--  Data awal: kota Jawa Tengah, tag, dan 5 kafe CONTOH (fiktif).
--  Hapus kafe contoh setelah kamu mengisi kafe asli lewat dashboard admin.
-- =====================================================================

insert into public.cities (name, slug, province, lat, lng, is_active) values
  ('Semarang',    'semarang',    'Jawa Tengah', -6.9932, 110.4203, true),
  ('Solo',        'solo',        'Jawa Tengah', -7.5755, 110.8243, true),
  ('Purwokerto',  'purwokerto',  'Jawa Tengah', -7.4246, 109.2396, true),
  ('Magelang',    'magelang',    'Jawa Tengah', -7.4797, 110.2177, true),
  ('Salatiga',    'salatiga',    'Jawa Tengah', -7.3305, 110.5084, false),
  ('Pekalongan',  'pekalongan',  'Jawa Tengah', -6.8886, 109.6753, false),
  ('Tegal',       'tegal',       'Jawa Tengah', -6.8694, 109.1402, false),
  ('Kudus',       'kudus',       'Jawa Tengah', -6.8048, 110.8405, false),
  ('Klaten',      'klaten',      'Jawa Tengah', -7.7058, 110.6061, false),
  ('Purwodadi',   'purwodadi',   'Jawa Tengah', -7.0868, 110.9158, false);

insert into public.tags (name, type) values
  ('WFC', 'vibe'), ('Nongkrong', 'vibe'), ('Date', 'vibe'), ('Outdoor', 'vibe'),
  ('Aesthetic', 'vibe'), ('Tenang', 'vibe'), ('Live Music', 'vibe'),
  ('Wifi', 'facility'), ('Colokan', 'facility'), ('Musholla', 'facility'),
  ('Parkir Mobil', 'facility'), ('Smoking Area', 'facility'), ('Buka 24 Jam', 'facility');

-- Jam buka standar
do $$
declare
  hrs jsonb := '{"mon":["08:00","22:00"],"tue":["08:00","22:00"],"wed":["08:00","22:00"],"thu":["08:00","22:00"],"fri":["08:00","23:00"],"sat":["08:00","23:00"],"sun":["09:00","22:00"]}';
  c uuid;
begin
  -- 1
  insert into public.cafes (slug, name, city_id, area, address, lat, lng, price_range, opening_hours, my_rating, short_review, is_featured, visited_at)
  values ('contoh-kopi-tembalang', 'Kopi Tembalang (Contoh)', (select id from public.cities where slug='semarang'),
          'Tembalang', 'Jl. Contoh No. 1, Tembalang, Semarang', -7.0525, 110.4381, 2, hrs, 4.5,
          'Tempat WFC favorit: meja lebar, colokan di tiap meja, dan kopi susu gula arennya pas.', true, '2026-09-12')
  returning id into c;
  insert into public.cafe_details values (c, 'Ulasan lengkap contoh: lantai 2 paling tenang untuk kerja. Wifi stabil 50 Mbps. Ramai mahasiswa setelah jam 7 malam.', 'Ambil meja dekat jendela lantai 2.', 'Pagi 08.00–11.00');
  insert into public.menu_items (cafe_id, name, price, note, is_must_try, sort_order) values
    (c, 'Kopi Susu Gula Aren', 22000, 'Manisnya pas, tidak terlalu creamy.', true, 1),
    (c, 'Croissant Almond', 28000, 'Renyah, cocok dengan kopi hitam.', false, 2),
    (c, 'Manual Brew V60', 30000, 'Biji lokal Temanggung, fruity.', true, 3);
  insert into public.cafe_tags select c, id from public.tags where name in ('WFC','Tenang','Wifi','Colokan','Musholla');

  -- 2
  insert into public.cafes (slug, name, city_id, area, address, lat, lng, price_range, opening_hours, my_rating, short_review, is_featured, visited_at)
  values ('contoh-teras-kota-lama', 'Teras Kota Lama (Contoh)', (select id from public.cities where slug='semarang'),
          'Kota Lama', 'Jl. Contoh No. 2, Kota Lama, Semarang', -6.9686, 110.4278, 3, hrs, 4.7,
          'Bangunan kolonial dengan teras luas, paling cantik saat sore.', true, '2026-08-30')
  returning id into c;
  insert into public.cafe_details values (c, 'Ulasan lengkap contoh: datang jam 4 sore untuk cahaya terbaik. Parkir agak sulit di akhir pekan.', 'Parkir di gedung sebelah lebih aman.', 'Sore 16.00–18.00');
  insert into public.menu_items (cafe_id, name, price, note, is_must_try, sort_order) values
    (c, 'Es Kopi Pandan', 32000, 'Wangi pandannya kuat.', true, 1),
    (c, 'Nasi Goreng Kampung', 45000, 'Porsi besar.', false, 2);
  insert into public.cafe_tags select c, id from public.tags where name in ('Date','Aesthetic','Outdoor','Smoking Area');

  -- 3
  insert into public.cafes (slug, name, city_id, area, address, lat, lng, price_range, opening_hours, my_rating, short_review, is_featured, visited_at)
  values ('contoh-omah-laweyan', 'Omah Laweyan (Contoh)', (select id from public.cities where slug='solo'),
          'Laweyan', 'Jl. Contoh No. 3, Laweyan, Solo', -7.5697, 110.7953, 2, hrs, 4.4,
          'Rumah joglo yang diubah jadi kafe, adem dan banyak tanaman.', false, '2026-07-20')
  returning id into c;
  insert into public.cafe_details values (c, 'Ulasan lengkap contoh: suasana Jawa yang kental, cocok ngobrol lama.', 'Coba duduk di pendopo belakang.', 'Malam 19.00–21.00');
  insert into public.menu_items (cafe_id, name, price, note, is_must_try, sort_order) values
    (c, 'Wedang Uwuh Latte', 25000, 'Perpaduan rempah dan susu, unik.', true, 1),
    (c, 'Timlo Mini', 30000, null, false, 2);
  insert into public.cafe_tags select c, id from public.tags where name in ('Nongkrong','Tenang','Outdoor','Parkir Mobil');

  -- 4
  insert into public.cafes (slug, name, city_id, area, address, lat, lng, price_range, opening_hours, my_rating, short_review, is_featured, visited_at)
  values ('contoh-kopi-baturraden', 'Kopi Lereng Slamet (Contoh)', (select id from public.cities where slug='purwokerto'),
          'Baturraden', 'Jl. Contoh No. 4, Baturraden, Purwokerto', -7.3127, 109.2283, 2, hrs, 4.6,
          'View Gunung Slamet langsung dari meja, udara sejuk.', true, '2026-06-15')
  returning id into c;
  insert into public.cafe_details values (c, 'Ulasan lengkap contoh: pagi hari kabut turun, bawa jaket.', 'Pilih area rooftop.', 'Pagi 07.00–09.00');
  insert into public.menu_items (cafe_id, name, price, note, is_must_try, sort_order) values
    (c, 'Kopi Tubruk Slamet', 15000, 'Biji robusta lokal.', true, 1),
    (c, 'Mendoan Hangat', 15000, 'Wajib kalau ke Banyumas.', true, 2);
  insert into public.cafe_tags select c, id from public.tags where name in ('Outdoor','Nongkrong','Parkir Mobil','Musholla');

  -- 5
  insert into public.cafes (slug, name, city_id, area, address, lat, lng, price_range, opening_hours, my_rating, short_review, is_featured, visited_at)
  values ('contoh-borobudur-brew', 'Brew Menoreh (Contoh)', (select id from public.cities where slug='magelang'),
          'Borobudur', 'Jl. Contoh No. 5, Borobudur, Magelang', -7.6079, 110.2038, 3, hrs, 4.3,
          'Kafe sawah dengan pemandangan Bukit Menoreh.', false, '2026-05-02')
  returning id into c;
  insert into public.cafe_details values (c, 'Ulasan lengkap contoh: tenang di hari kerja, ramai wisatawan saat libur.', 'Datang hari kerja.', 'Sore 15.00–17.30');
  insert into public.menu_items (cafe_id, name, price, note, is_must_try, sort_order) values
    (c, 'Affogato', 35000, null, true, 1),
    (c, 'Pisang Goreng Keju', 25000, null, false, 2);
  insert into public.cafe_tags select c, id from public.tags where name in ('Date','Outdoor','Aesthetic','Wifi');
end $$;

-- =====================================================================
--  Jadikan akunmu admin (jalankan SETELAH kamu daftar/login sekali):
--  update public.profiles set role = 'admin' where email = 'email-kamu@gmail.com';
-- =====================================================================
