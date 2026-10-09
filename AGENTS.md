# WFC Hunters (workfromcafe)

Next.js 15 App Router + Supabase + Tailwind v4, deploy di Vercel (region sin1).

## Aturan UI, teks, dan kode: antislop

Untuk pekerjaan UI, copy, tata letak HP, atau komentar kode:

1. Baca `DESIGN.md` untuk arah desain (identitas, palet, tipografi, dial).
2. Baca skill antislop yang sesuai di `.claude/skills/` sebagai filter:
   - inti (selalu): `.claude/skills/antislop/SKILL.md`
   - UI: `.claude/skills/antislop-ui/SKILL.md`
   - copy: `.claude/skills/antislop-copywriting/SKILL.md`
   - HP/responsif: `.claude/skills/antislop-layoutmobile/SKILL.md`
   - orang/foto/avatar: `.claude/skills/antislop-human/SKILL.md`
   - komentar kode: `.claude/skills/antislop-code/SKILL.md`
3. Mode antislop proyek ini: **during** (dipilih pemilik proyek). Jalankan Delivery Gate sebelum menyerahkan.

## Catatan proyek

- Migrasi SQL ada di `supabase/migrations/`, dijalankan manual di Supabase SQL Editor (berurutan).
- Jangan menulis angka/statistik yang tidak berasal dari database.
- Cek build: `NEXT_PUBLIC_SUPABASE_URL=https://demo.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=demo SUPABASE_SERVICE_ROLE_KEY=x npx next build`
