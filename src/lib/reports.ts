/** Laporan kondisi hari ini: label, batas, dan ringkasan yang dipakai di halaman kafe & daftar kafe. */

export const REPORT_FRESH_HOURS = 3;
/** Pelapor harus berada sedekat ini dari titik kafe (meter), ditambah toleransi akurasi GPS. */
export const REPORT_RADIUS_M = 300;

export const CROWD = {
  1: { label: "Sepi", tone: "ok" },
  2: { label: "Sedang", tone: "mid" },
  3: { label: "Ramai", tone: "busy" },
} as const;

export const PLUGS = {
  1: "Gampang dapat",
  2: "Harus cari",
  3: "Penuh",
} as const;

export type CafeReport = {
  id: string; crowd: 1 | 2 | 3; plugs: 1 | 2 | 3 | null;
  download_mbps: number | null; upload_mbps: number | null; ping_ms: number | null;
  note: string | null; created_at: string; user_id: string; author_name: string; author_avatar: string | null;
};

export type LiveSummary = { cafe_id: string; crowd: 1 | 2 | 3; plugs: 1 | 2 | 3 | null; download_mbps: number | null; reports: number; last_at: string };

export const isFresh = (iso: string) => Date.now() - new Date(iso).getTime() < REPORT_FRESH_HOURS * 36e5;

/** "20 mnt lalu", "2 jam lalu", "kemarin 16.20", "12 Okt" */
export function reportAgo(iso: string) {
  const d = new Date(iso);
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 6e4));
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} mnt lalu`;
  const h = Math.floor(min / 60);
  if (h < 24 && d.toDateString() === new Date().toDateString()) return `${h} jam lalu`;
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  const y = new Date(Date.now() - 864e5);
  if (d.toDateString() === y.toDateString()) return `kemarin ${time}`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
}

/** Wifi cukup untuk apa (dipakai di hasil tes) */
export function wifiVerdict(mbps: number) {
  if (mbps >= 25) return "Cukup untuk video call";
  if (mbps >= 8) return "Cukup untuk kerja biasa & meeting audio";
  if (mbps >= 2) return "Pelan, cukup untuk chat dan email";
  return "Sangat pelan";
}

/** Ringkasan dari laporan yang masih baru: keramaian & colokan dari laporan terbaru, wifi median. */
export function summarize(reports: CafeReport[]) {
  const fresh = reports.filter((r) => isFresh(r.created_at));
  if (!fresh.length) return null;
  const speeds = fresh.map((r) => r.download_mbps).filter((v): v is number => v != null).map(Number).sort((a, b) => a - b);
  const mid = Math.floor(speeds.length / 2);
  const median = !speeds.length ? null : speeds.length % 2 ? speeds[mid] : (speeds[mid - 1] + speeds[mid]) / 2;
  return {
    crowd: fresh[0].crowd,
    plugs: fresh.find((r) => r.plugs != null)?.plugs ?? null,
    download: median != null ? Math.round(median) : null,
    count: fresh.length,
    lastAt: fresh[0].created_at,
  };
}

/** Jarak dua titik dalam meter (haversine) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
