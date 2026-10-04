/*
  Penilaian per aspek & fasilitas kafe.
  Disimpan di kolom cafes.scores dan cafes.amenities (jsonb).
*/

export type ScoreKey = "internet" | "colokan" | "ketenangan" | "kursi" | "kopi" | "toilet" | "pelayanan" | "harga";

export type Scores = Partial<Record<ScoreKey, number>> & { notes?: Partial<Record<ScoreKey, string>> };

/** label & keterangan untuk nilai 1..5 (indeks 0 = nilai 1) */
type Level = [string, string];

export const ASPECTS: { key: ScoreKey; label: string; icon: string; levels: [Level, Level, Level, Level, Level] }[] = [
  {
    key: "internet", label: "Kecepatan internet", icon: "gauge",
    levels: [
      ["Sangat lambat", "Hampir tidak bisa dipakai, bawa kuota sendiri."],
      ["Lambat", "Sering tersendat, siapkan hotspot cadangan."],
      ["Cukup", "Aman untuk chat dan browsing, video call kadang putus."],
      ["Cepat", "Lancar untuk meeting online dan kerja harian."],
      ["Sangat cepat", "Lancar untuk video call, upload, dan kerja seharian."],
    ],
  },
  {
    key: "colokan", label: "Colokan", icon: "plug",
    levels: [
      ["Hampir tidak ada", "Datang dengan baterai penuh."],
      ["Sedikit", "Hanya beberapa titik dan cepat terisi."],
      ["Terbatas", "Ada, tapi perlu memilih meja yang tepat."],
      ["Mudah dijangkau", "Sebagian besar kursi dekat colokan."],
      ["Melimpah", "Hampir setiap meja punya colokan."],
    ],
  },
  {
    key: "ketenangan", label: "Ketenangan", icon: "volume",
    levels: [
      ["Sangat bising", "Lebih cocok untuk nongkrong daripada kerja."],
      ["Ramai", "Siapkan headphone supaya bisa fokus."],
      ["Sedang", "Ada musik dan obrolan, masih bisa kerja."],
      ["Tenang", "Nyaman untuk fokus, sesekali ramai."],
      ["Setenang perpustakaan", "Ideal untuk fokus dan meeting beruntun."],
    ],
  },
  {
    key: "kursi", label: "Kenyamanan kursi", icon: "sofa",
    levels: [
      ["Tidak nyaman", "Cocok untuk mampir sebentar saja."],
      ["Kurang nyaman", "Kursi kecil atau tanpa sandaran."],
      ["Lumayan", "Oke untuk satu sampai dua jam."],
      ["Nyaman", "Enak untuk sesi kerja yang panjang."],
      ["Sangat nyaman", "Betah duduk berjam-jam tanpa pegal."],
    ],
  },
  {
    key: "kopi", label: "Rasa kopi", icon: "cup",
    levels: [
      ["Mengecewakan", "Kopinya tidak aku rekomendasikan."],
      ["Kurang", "Lebih baik pesan menu lain."],
      ["Standar", "Tidak istimewa, tapi tidak mengecewakan."],
      ["Enak", "Kopinya bisa diandalkan."],
      ["Istimewa", "Salah satu alasan utama untuk kembali."],
    ],
  },
  {
    key: "toilet", label: "Kebersihan toilet", icon: "sparkle",
    levels: [
      ["Kotor", "Sebaiknya dihindari."],
      ["Kurang bersih", "Perlu perhatian lebih."],
      ["Cukup", "Layak dipakai."],
      ["Bersih", "Terasa terawat."],
      ["Sangat bersih", "Bersih dan terawat setiap saat."],
    ],
  },
  {
    key: "pelayanan", label: "Pelayanan", icon: "smile",
    levels: [
      ["Kurang ramah", "Pelayanan perlu banyak perbaikan."],
      ["Lambat", "Pesanan sering lama datang."],
      ["Biasa", "Standar, tidak ada keluhan."],
      ["Baik", "Ramah dan cukup cepat."],
      ["Istimewa", "Ramah, cepat, dan sigap membantu."],
    ],
  },
  {
    key: "harga", label: "Harga sepadan", icon: "wallet",
    levels: [
      ["Mahal", "Harga tidak sebanding dengan yang didapat."],
      ["Agak mahal", "Sedikit di atas kualitas yang didapat."],
      ["Wajar", "Harga standar kafe di kotanya."],
      ["Sepadan", "Sebanding dengan yang didapat."],
      ["Sangat sepadan", "Terasa murah untuk kualitasnya."],
    ],
  },
];

export function levelOf(aspect: (typeof ASPECTS)[number], score: number): Level {
  const i = Math.min(5, Math.max(1, Math.round(score))) - 1;
  return aspect.levels[i];
}

/** Nilai yang terisi saja, dibulatkan ke 0,5 terdekat dan dibatasi 1–5. */
export function cleanScore(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5, Math.max(1, Math.round(n * 2) / 2));
}

export function filledAspects(scores: Scores | null | undefined) {
  return ASPECTS.flatMap((a) => {
    const s = cleanScore(scores?.[a.key]);
    return s == null ? [] : [{ ...a, score: s, note: scores?.notes?.[a.key]?.trim() || null }];
  });
}

export function averageScore(scores: Scores | null | undefined): number | null {
  const f = filledAspects(scores);
  return f.length ? f.reduce((t, a) => t + a.score, 0) / f.length : null;
}

export function overallVerdict(score: number): [string, string] {
  if (score >= 4.5) return ["Istimewa", "Tempat kerja yang hampir tanpa cela."];
  if (score >= 4) return ["Sangat baik", "Nyaman dan bisa diandalkan, hampir sempurna."];
  if (score >= 3.5) return ["Baik", "Enak untuk kerja, dengan beberapa catatan kecil."];
  if (score >= 3) return ["Cukup", "Bisa dipakai kerja, tapi ada kompromi."];
  return ["Kurang", "Lebih cocok untuk mampir sebentar."];
}

// ---------------------------------------------------------------------------
// Fasilitas
// ---------------------------------------------------------------------------

export type AmenityKey =
  | "wifi" | "colokan" | "parkir" | "ruang_meeting" | "mushola" | "makanan_berat"
  | "ac" | "outdoor" | "area_merokok" | "meja_berdiri" | "ramah_hewan" | "musik";

/** true = ada, false = tidak ada, null/absen = belum dicek */
export type Amenities = Partial<Record<AmenityKey, boolean | null>>;

export const AMENITIES: { key: AmenityKey; label: string; icon: string }[] = [
  { key: "wifi", label: "Internet / Wi-Fi", icon: "wifi" },
  { key: "colokan", label: "Colokan", icon: "plug" },
  { key: "parkir", label: "Parkir", icon: "car" },
  { key: "ruang_meeting", label: "Ruang meeting", icon: "users" },
  { key: "mushola", label: "Mushola", icon: "moon" },
  { key: "makanan_berat", label: "Makanan berat", icon: "utensils" },
  { key: "ac", label: "Ruangan AC", icon: "snow" },
  { key: "outdoor", label: "Area outdoor", icon: "tree" },
  { key: "area_merokok", label: "Area merokok", icon: "smoke" },
  { key: "meja_berdiri", label: "Meja berdiri", icon: "desk" },
  { key: "ramah_hewan", label: "Ramah hewan", icon: "paw" },
  { key: "musik", label: "Ada musik", icon: "music" },
];

/** Baca "ya" / "tidak" / "?" dari spreadsheet atau form. undefined = sel kosong (jangan ubah). */
export function parseAmenity(v: string | null | undefined): boolean | null | undefined {
  const t = (v ?? "").trim().toLowerCase();
  if (!t) return undefined;
  if (/^(ya|y|yes|ada|true|1|v|✓)$/.test(t)) return true;
  if (/^(tidak|tdk|no|n|false|0|x|✗|-|tidak ada|gak|nggak)$/.test(t)) return false;
  return null; // "?", "belum tahu", dll.
}

export const hasAnyAmenity = (a: Amenities | null | undefined) => !!a && AMENITIES.some((m) => typeof a[m.key] === "boolean");
