import sharp from "sharp";
import { createAdminClient } from "./supabase/server";

/*
  Thumbnail foto kafe untuk kartu di daftar (640 px, WebP). Foto asli tetap dipakai di halaman kafe.
  Dibuat di server: setelah admin mengunggah foto, setelah rekomendasi author disetujui,
  dan lewat tombol "Buat thumbnail" di admin untuk foto lama.
*/

const WIDTH = 640;
const MARKER = "/storage/v1/object/public/cafe-photos/";

type Row = { id: string; url: string };

async function makeOne(db: ReturnType<typeof createAdminClient>, p: Row) {
  const i = p.url.indexOf(MARKER);
  // Foto dari luar bucket (mis. link spreadsheet) juga dibuatkan thumbnail, disimpan di folder thumbs/luar/
  const rel = i >= 0 ? p.url.slice(i + MARKER.length).replace(/\.[a-z0-9]+$/i, "") : `luar/${p.id}`;
  const res = await fetch(p.url);
  if (!res.ok) throw new Error(`unduh ${res.status}`);
  const out = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
  const path = `thumbs/${rel}.webp`;
  const { error } = await db.storage.from("cafe-photos").upload(path, out, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (error) throw error;
  const thumb = db.storage.from("cafe-photos").getPublicUrl(path).data.publicUrl;
  await db.from("cafe_photos").update({ thumb_url: thumb }).eq("id", p.id);
}

/** Buat thumbnail untuk foto yang belum punya. `cafeId` membatasi ke satu kafe. Mengembalikan jumlah yang dibuat & yang tersisa. */
export async function ensureThumbs(opts: { cafeId?: string; limit?: number } = {}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { made: 0, failed: 0, left: 0 };
  const db = createAdminClient();
  let q = db.from("cafe_photos").select("id,url", { count: "exact" }).is("thumb_url", null).order("sort_order").limit(opts.limit ?? 12);
  if (opts.cafeId) q = q.eq("cafe_id", opts.cafeId);
  const { data, count, error } = await q;
  if (error) return { made: 0, failed: 0, left: 0, error: error.message }; // mis. migrasi 0019 belum dijalankan
  let made = 0, failed = 0;
  for (const p of (data as Row[] | null) ?? []) {
    try { await makeOne(db, p); made++; } catch (e) { failed++; console.error("[thumbs]", p.id, e); }
  }
  return { made, failed, left: Math.max(0, (count ?? 0) - made) };
}
