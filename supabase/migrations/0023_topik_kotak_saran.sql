-- =====================================================================
--  0023: Topik baru untuk Kotak saran (bug, update platform, saran & kritik)
--  Aman dijalankan ulang. Sebelum ini dijalankan, pesan bertopik baru tetap tersimpan sebagai "lainnya".
-- =====================================================================
alter table public.contact_messages drop constraint if exists contact_messages_topic_check;
alter table public.contact_messages add constraint contact_messages_topic_check
  check (topic in ('saran', 'kafe_saya', 'koreksi', 'kerja_sama', 'lainnya', 'bug', 'platform', 'kritik'));
