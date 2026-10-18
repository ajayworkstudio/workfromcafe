/**
 * Tes kecepatan wifi di browser, tanpa layanan luar:
 * - jeda: waktu bolak-balik file kecil dari CDN situs ini (diambil yang tercepat)
 * - unduh: dua unduhan paralel file acak 4 MB dari CDN, dihitung dari byte pertama
 * - unggah: kirim 1,5 MB ke /api/speedtest
 * Total data sekitar 10 MB, dibatasi 8 detik per tahap.
 */

export type SpeedPhase = "ping" | "download" | "upload" | "done";
export type SpeedResult = { download: number; upload: number | null; ping: number };

const bust = () => `?r=${Date.now()}-${Math.random().toString(36).slice(2)}`;
const LIMIT_MS = 8000;

async function measurePing(signal: AbortSignal) {
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await fetch(`/speedtest/ping.txt${bust()}`, { cache: "no-store", signal });
    times.push(performance.now() - t);
  }
  return Math.round(Math.min(...times.slice(1))); // yang pertama ikut menghitung buka koneksi
}

async function measureDownload(signal: AbortSignal, onMbps: (mbps: number) => void) {
  let bytes = 0;
  let first = 0;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), LIMIT_MS);
  signal.addEventListener("abort", () => stop.abort());
  const one = async () => {
    const res = await fetch(`/speedtest/4mb.bin${bust()}`, { cache: "no-store", signal: stop.signal });
    const reader = res.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!first) first = performance.now();
      bytes += value.byteLength;
      const secs = (performance.now() - first) / 1000;
      if (secs > 0.2) onMbps((bytes * 8) / secs / 1e6);
    }
  };
  try {
    await Promise.all([one(), one()]);
  } catch (e) {
    if (signal.aborted) throw e; // dibatalkan pengguna; kalau kena batas waktu, pakai yang sudah terunduh
  } finally {
    clearTimeout(timer);
  }
  const secs = first ? (performance.now() - first) / 1000 : 0;
  if (!secs || !bytes) throw new Error("Tes unduh gagal");
  return (bytes * 8) / secs / 1e6;
}

async function measureUpload(signal: AbortSignal) {
  const size = 1.5 * 1024 * 1024;
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i += 65536) crypto.getRandomValues(data.subarray(i, Math.min(i + 65536, size)));
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), LIMIT_MS);
  signal.addEventListener("abort", () => stop.abort());
  try {
    const t = performance.now();
    const res = await fetch(`/api/speedtest${bust()}`, { method: "POST", body: data, signal: stop.signal, headers: { "Content-Type": "application/octet-stream" } });
    if (!res.ok) return null;
    return (size * 8) / ((performance.now() - t) / 1000) / 1e6;
  } catch {
    if (signal.aborted) throw new DOMException("Dibatalkan", "AbortError");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function runSpeedTest(signal: AbortSignal, onUpdate: (phase: SpeedPhase, mbps?: number) => void): Promise<SpeedResult> {
  onUpdate("ping");
  const ping = await measurePing(signal);
  onUpdate("download", 0);
  const download = await measureDownload(signal, (m) => onUpdate("download", m));
  onUpdate("upload");
  const upload = await measureUpload(signal);
  onUpdate("done");
  const round = (v: number) => Math.round(v * 10) / 10;
  return { ping, download: round(download), upload: upload == null ? null : round(upload) };
}

/** true kalau browser tahu HP sedang memakai data seluler (hanya sebagian Android yang memberi tahu) */
export function onCellular() {
  const c = (navigator as Navigator & { connection?: { type?: string } }).connection;
  return c?.type === "cellular";
}
