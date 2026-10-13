import type { SupabaseClient } from "@supabase/supabase-js";
import type { Submission, SubmissionData } from "./submission";
import { filledAspects } from "./review";

/*
  Analisis kebiasaan admin saat menerima/menolak rekomendasi, dan penilaian kiriman baru.

  Dua jenis cek:
  - wajib (hard): kalau satu saja gagal, kiriman tidak boleh tayang otomatis
  - pendukung (soft): hanya memengaruhi skor, untuk membantu admin memutuskan

  Ambang foto / penilaian / panjang ulasan dipelajari dari kiriman yang pernah kamu terima
  (persentil ke-20). Selama riwayat masih sedikit, dipakai ambang awal yang aman.
*/

export const AUTO_NOTE = "Disetujui otomatis.";
export const MIN_HISTORY = 10;
const DUP_RADIUS_M = 100;
const DEFAULTS = { photos: 2, aspects: 3, reviewLen: 25 };
const FLOOR = { photos: 1, aspects: 2, reviewLen: 10 };
// Batas atas: ambang yang dipelajari tidak boleh lebih ketat dari ini
const CAP = { photos: 5, aspects: 6, reviewLen: 60 };

type CafeLite = { id: string; name: string; city_id: string | null; lat: number | null; lng: number | null; address: string | null; area: string | null; short_review: string | null; photos?: { id: string }[] };

export type Patterns = {
  decided: number;
  approved: number;
  rejected: number;
  reliable: boolean;
  thresholds: { photos: number; aspects: number; reviewLen: number };
  /** Median kiriman diterima vs ditolak, untuk ditampilkan */
  medians: { approved: Feat; rejected: Feat };
  /** Kata yang paling sering muncul di catatan penolakan */
  rejectWords: [string, number][];
  /** Seberapa sering kamu mengubah bagian tertentu setelah menerima kiriman */
  editRates: { field: string; label: string; edited: number; total: number }[];
  autoCount: number;
};

type Feat = { photos: number; aspects: number; reviewLen: number; menu: number };

export type Check = { key: string; label: string; ok: boolean; hard: boolean; detail: string; /** Nama singkat masalahnya kalau gagal, mis. "foto kurang" */ issue: string };
export type Evaluation = { pass: boolean; score: number; checks: Check[] };

export type ReviewContext = {
  history: Submission[];
  cafes: CafeLite[];
  pending: Submission[];
  patterns: Patterns;
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ")
  .replace(/\b(kafe|cafe|caffe|coffee|kopi|kedai|warung|and|dan|the|space|roastery|eatery|co)\b/g, " ").replace(/\s+/g, " ").trim();

export function distanceM(a: [number, number], b: [number, number]) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const feat = (d: SubmissionData): Feat => ({
  photos: d.photos?.length ?? 0,
  aspects: filledAspects(d.scores ?? {}).length,
  reviewLen: (d.short_review ?? "").trim().length,
  menu: d.menu?.length ?? 0,
});

const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
};
const median = (fs: Feat[]): Feat => ({
  photos: quantile(fs.map((f) => f.photos), 0.5),
  aspects: quantile(fs.map((f) => f.aspects), 0.5),
  reviewLen: quantile(fs.map((f) => f.reviewLen), 0.5),
  menu: quantile(fs.map((f) => f.menu), 0.5),
});

const STOP = new Set("yang dan di ke dari ini itu untuk dengan atau ada sudah belum bisa kamu kami aku ya tidak juga karena jadi lagi saja masih mohon terima kasih dulu nanti agar supaya lebih kafe".split(" "));

export function learnPatterns(history: Submission[], cafes: CafeLite[]): Patterns {
  const approvedSubs = history.filter((s) => s.status === "approved");
  const manualApproved = approvedSubs.filter((s) => !(s.admin_note ?? "").startsWith(AUTO_NOTE));
  const rejectedSubs = history.filter((s) => s.status === "rejected");
  const decided = manualApproved.length + rejectedSubs.length;
  const reliable = decided >= MIN_HISTORY && manualApproved.length >= 5;

  // Belajar hanya dari keputusan manual, supaya hasil otomatis tidak "mengajari dirinya sendiri"
  const af = manualApproved.map((s) => feat(s.data));
  const thresholds = reliable
    ? {
        photos: Math.min(CAP.photos, Math.max(FLOOR.photos, quantile(af.map((f) => f.photos), 0.2))),
        aspects: Math.min(CAP.aspects, Math.max(FLOOR.aspects, quantile(af.map((f) => f.aspects), 0.2))),
        reviewLen: Math.min(CAP.reviewLen, Math.max(FLOOR.reviewLen, quantile(af.map((f) => f.reviewLen), 0.2))),
      }
    : { ...DEFAULTS };

  const words = new Map<string, number>();
  for (const s of rejectedSubs) {
    for (const w of (s.admin_note ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length > 3 && !STOP.has(w)) words.set(w, (words.get(w) ?? 0) + 1);
    }
  }

  // Bandingkan isi kiriman dengan kafe yang sekarang tayang: bagian mana yang biasanya kamu ubah
  const byId = new Map(cafes.map((c) => [c.id, c]));
  const fields: { field: string; label: string; changed: (d: SubmissionData, c: CafeLite) => boolean }[] = [
    { field: "name", label: "nama kafe", changed: (d, c) => d.name.trim() !== c.name.trim() },
    { field: "address", label: "alamat", changed: (d, c) => (d.address ?? "") !== (c.address ?? "") },
    { field: "area", label: "area", changed: (d, c) => (d.area ?? "") !== (c.area ?? "") },
    { field: "short_review", label: "ulasan singkat", changed: (d, c) => (d.short_review ?? "").trim() !== (c.short_review ?? "").trim() },
    { field: "location", label: "titik lokasi", changed: (d, c) => d.lat != null && c.lat != null && d.lng != null && c.lng != null && distanceM([d.lat, d.lng], [c.lat, c.lng]) > 30 },
    { field: "photos", label: "foto", changed: (d, c) => (c.photos?.length ?? 0) !== (d.photos?.length ?? 0) },
  ];
  const editRates = fields.map((f) => {
    let edited = 0, total = 0;
    for (const s of manualApproved) {
      const c = s.cafe_id ? byId.get(s.cafe_id) : undefined;
      if (!c) continue;
      total++;
      if (f.changed(s.data, c)) edited++;
    }
    return { field: f.field, label: f.label, edited, total };
  });

  return {
    decided,
    approved: manualApproved.length,
    rejected: rejectedSubs.length,
    reliable,
    thresholds,
    medians: { approved: median(af), rejected: median(rejectedSubs.map((s) => feat(s.data))) },
    rejectWords: [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    editRates: editRates.filter((e) => e.total > 0),
    autoCount: approvedSubs.length - manualApproved.length,
  };
}

/** Ambil semua data yang dibutuhkan untuk menilai kiriman (riwayat, kafe yang ada, kiriman lain yang menunggu). */
export async function loadReviewContext(db: SupabaseClient): Promise<ReviewContext> {
  const [{ data: hist }, { data: cafes }, { data: pending }] = await Promise.all([
    db.from("cafe_submissions").select("*").in("status", ["approved", "rejected"]).order("reviewed_at", { ascending: false }).limit(500),
    db.from("cafes").select("id,name,city_id,lat,lng,address,area,short_review,photos:cafe_photos(id)").limit(5000),
    db.from("cafe_submissions").select("*").eq("status", "pending").limit(500),
  ]);
  const history = (hist as Submission[] | null) ?? [];
  const cafeList = (cafes as CafeLite[] | null) ?? [];
  return { history, cafes: cafeList, pending: (pending as Submission[] | null) ?? [], patterns: learnPatterns(history, cafeList) };
}

export type AutoSettings = { trustNewAuthors: boolean; dailyLimit: number };

export function evaluateSubmission(sub: Submission, ctx: ReviewContext, opts: AutoSettings): Evaluation {
  const d = sub.data;
  const f = feat(d);
  const t = ctx.patterns.thresholds;
  const checks: Check[] = [];
  const add = (key: string, label: string, ok: boolean, hard: boolean, detail: string, issue: string) => checks.push({ key, label, ok, hard, detail, issue });

  // 1. Lokasi
  const hasLoc = d.lat != null && d.lng != null;
  add("lokasi", "Titik lokasi jelas", hasLoc, true, hasLoc ? "Koordinat terbaca dari link Maps." : "Tidak ada koordinat, jadi tidak bisa dicek duplikat dan tidak muncul di peta.", "tanpa titik lokasi");

  // 2. Duplikat: kafe yang sudah ada, atau kiriman lain yang sedang menunggu
  const n = norm(d.name);
  const near = (lat: number | null, lng: number | null) => hasLoc && lat != null && lng != null && distanceM([d.lat!, d.lng!], [lat, lng]) <= DUP_RADIUS_M;
  const dupCafe = ctx.cafes.find((c) => near(c.lat, c.lng) || (!!n && norm(c.name) === n && (!d.city_id || c.city_id === d.city_id)));
  const dupPending = ctx.pending.find((p) => p.id !== sub.id && (norm(p.data.name) === n || near(p.data.lat, p.data.lng)) && p.created_at < sub.created_at);
  add("duplikat", "Belum ada di WFC Hunters", !dupCafe && !dupPending, true,
    dupCafe ? `Mirip kafe yang sudah ada: ${dupCafe.name}.` : dupPending ? `Mirip kiriman lain yang sedang menunggu: ${dupPending.data.name}.` : `Tidak ada kafe dengan nama sama atau dalam ${DUP_RADIUS_M} m.`, "mungkin duplikat");

  // 3. Hubungan dengan kafe
  add("netral", "Ditulis pengunjung", d.relation === "pengunjung", true,
    d.relation === "pengunjung" ? "Bukan pemilik atau karyawan." : "Ditulis pemilik/karyawan, penilaian mungkin tidak netral.", "ditulis pemilik/karyawan");

  // 4. Kota
  add("kota", "Kota sudah terdaftar", !!d.city_id, true, d.city_id ? `Kota ${d.city_name}.` : `Kota baru "${d.city_name}" perlu kamu buat dulu.`, "kota baru");

  // 5-7. Kelengkapan (ambang dipelajari dari kebiasaanmu)
  const src = ctx.patterns.reliable ? "dari kiriman yang biasa kamu terima" : "ambang awal";
  add("foto", `Minimal ${t.photos} foto`, f.photos >= t.photos, true, `${f.photos} foto (${src}: minimal ${t.photos}).`, "foto kurang");
  add("penilaian", `Minimal ${t.aspects} aspek dinilai`, f.aspects >= t.aspects, true, `${f.aspects} dari 8 aspek (${src}: minimal ${t.aspects}).`, "penilaian kurang");
  add("ulasan", "Ulasan singkat cukup jelas", f.reviewLen >= t.reviewLen, true, `${f.reviewLen} huruf (${src}: minimal ${t.reviewLen}).`, "ulasan terlalu pendek");

  // 8. Teks bersih dari link/nomor telepon (promosi)
  const text = [d.short_review, d.full_review, d.tips].filter(Boolean).join(" ");
  const spam = /https?:\/\/|www\.|wa\.me|(?:\+62|62|0)8\d{7,11}/i.test(text);
  add("bersih", "Tanpa link atau nomor telepon", !spam, true, spam ? "Ada link atau nomor telepon di ulasan." : "Ulasan tidak berisi promosi.", "ada link/nomor telepon");

  // 9. Rekam jejak author
  const mine = ctx.history.filter((h) => h.user_id === sub.user_id);
  const myApproved = mine.filter((h) => h.status === "approved").length;
  const recentReject = mine.find((h) => h.status === "rejected" && h.reviewed_at && Date.now() - new Date(h.reviewed_at).getTime() < 14 * 864e5);
  const trusted = opts.trustNewAuthors || myApproved > 0;
  add("author", "Author sudah pernah disetujui", trusted && !recentReject, true,
    recentReject ? "Ada kiriman author ini yang kamu tolak dalam 14 hari terakhir."
      : myApproved > 0 ? `${myApproved} kiriman author ini pernah diterima.` : opts.trustNewAuthors ? "Author baru, setelan mengizinkan author baru." : "Author baru: kiriman pertama tetap kamu cek dulu.",
    recentReject ? "author baru saja ditolak" : "author baru");

  // 10. Batas harian
  const today = new Date(Date.now() - 864e5).toISOString();
  const autoToday = mine.filter((h) => (h.admin_note ?? "").startsWith(AUTO_NOTE) && (h.reviewed_at ?? "") > today).length;
  add("batas", `Maksimal ${opts.dailyLimit} tayang otomatis per author per hari`, autoToday < opts.dailyLimit, true, `${autoToday} kiriman author ini tayang otomatis dalam 24 jam terakhir.`, "batas harian tercapai");

  // Pendukung: hal yang sering kamu lengkapi setelah menerima
  const editAddr = ctx.patterns.editRates.find((e) => e.field === "address");
  add("alamat", "Alamat diisi", !!d.address?.trim(), false,
    d.address?.trim() ? "Alamat terisi." : `Alamat kosong${editAddr && editAddr.edited ? ` (kamu mengubah alamat di ${editAddr.edited} dari ${editAddr.total} kiriman yang diterima)` : ""}.`, "alamat kosong");
  add("menu", "Ada menu rekomendasi", f.menu > 0, false, f.menu ? `${f.menu} menu.` : "Belum ada menu.", "tanpa menu");
  add("jam", "Jam buka diisi", !!d.opening_hours && Object.values(d.opening_hours).some(Boolean), false, d.opening_hours ? "Jam buka terisi." : "Jam buka belum diisi.", "jam buka kosong");

  const weight = (c: Check) => (c.hard ? 2 : 1);
  const total = checks.reduce((s, c) => s + weight(c), 0);
  const got = checks.reduce((s, c) => s + (c.ok ? weight(c) : 0), 0);
  return { pass: checks.every((c) => !c.hard || c.ok), score: Math.round((got / total) * 100), checks };
}
