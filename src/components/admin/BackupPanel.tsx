"use client";
import { useState } from "react";
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";
import { BACKUP_TABLES } from "@/lib/backup";
import Icon from "@/components/Icon";

type Row = Record<string, unknown>;
type Step = { label: string; detail: string; ok?: boolean };

const csv = (rows: Row[]) => {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
};

const mb = (n: number) => `${(n / 1048576).toFixed(n > 1048576 * 10 ? 0 : 1).replace(".", ",")} MB`;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

/**
 * Satu tombol, satu file zip: semua tabel penting (JSON + CSV), daftar akun, dan foto kafe.
 * Zip dirangkai di browser ini dari potongan kecil, jadi tidak kena batas ukuran server.
 * Foto diambil lewat /foto (CDN Vercel), jadi hampir tidak memakai kuota Supabase.
 */
export default function BackupPanel() {
  const [withPhotos, setWithPhotos] = useState(true);
  const [withThumbs, setWithThumbs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const log = (s: Step) => setSteps((x) => [...x, s]);

  async function run() {
    setBusy(true); setSteps([]); setResult(null); setProgress(null);
    const chunks: Uint8Array[] = [];
    const zip = new Zip((err, chunk) => { if (err) throw err; chunks.push(chunk); });
    const addFile = (name: string, data: Uint8Array, compress = true) => {
      const f = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
      zip.add(f); f.push(data, true);
    };
    const stamp = new Date();
    const summary: string[] = [];

    try {
      // 1. Tabel
      for (const t of BACKUP_TABLES) {
        const rows: Row[] = [];
        let skipped = "";
        for (let from = 0; ; from += 1000) {
          const r = await getJson<{ rows: Row[]; done: boolean; skipped?: string }>(`/api/admin/backup?t=${t}&from=${from}`);
          rows.push(...(Array.isArray(r.rows) ? r.rows : []));
          if (r.skipped) skipped = r.skipped;
          if (r.done) break;
        }
        addFile(`data/${t}.json`, strToU8(JSON.stringify(rows, null, 2)));
        addFile(`data/${t}.csv`, strToU8(csv(rows)));
        summary.push(`${t}: ${rows.length} baris${skipped ? " (tabel belum ada)" : ""}`);
        log({ label: t, detail: skipped ? "dilewati, tabel belum ada" : `${rows.length} baris`, ok: !skipped });
      }

      // 2. Akun pengguna (tanpa password)
      const users: Row[] = [];
      for (let page = 1; ; page++) {
        const r = await getJson<{ rows: Row[]; done: boolean }>(`/api/admin/backup?t=_auth&page=${page}`);
        users.push(...r.rows);
        if (r.done) break;
      }
      addFile("data/auth_users.json", strToU8(JSON.stringify(users, null, 2)));
      addFile("data/auth_users.csv", strToU8(csv(users)));
      summary.push(`auth_users: ${users.length} akun`);
      log({ label: "Akun pengguna", detail: `${users.length} akun`, ok: true });

      // 3. Foto
      const failed: string[] = [];
      if (withPhotos) {
        const { files } = await getJson<{ files: { path: string; size: number }[] }>("/api/admin/backup?t=_files");
        const list = files.filter((f) => withThumbs || !f.path.startsWith("thumbs/"));
        log({ label: "Daftar foto", detail: `${list.length} file, sekitar ${mb(list.reduce((a, f) => a + f.size, 0))}`, ok: true });
        setProgress({ done: 0, total: list.length });
        let done = 0, next = 0;
        const worker = async () => {
          while (next < list.length) {
            const f = list[next++];
            try {
              const res = await fetch(`/foto/${f.path.split("/").map(encodeURIComponent).join("/")}`);
              if (!res.ok) throw new Error(String(res.status));
              addFile(`foto/${f.path}`, new Uint8Array(await res.arrayBuffer()), false); // sudah terkompres (webp/jpg)
            } catch { failed.push(f.path); }
            setProgress({ done: ++done, total: list.length });
          }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        summary.push(`foto: ${list.length - failed.length} dari ${list.length} file${failed.length ? ` (${failed.length} gagal, lihat foto-gagal.txt)` : ""}`);
        if (failed.length) addFile("foto-gagal.txt", strToU8(failed.join("\n")));
      }

      // 4. Catatan
      addFile("BACA-SAYA.txt", strToU8([
        `Backup WFC Hunters, dibuat ${stamp.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
        "",
        "Isi:",
        ...summary.map((s) => `- ${s}`),
        "",
        "Folder data/: satu file .json (lengkap, untuk dipulihkan) dan .csv (dibuka di Excel/Sheets) per tabel.",
        "Folder foto/: isi bucket Supabase cafe-photos dengan struktur folder yang sama.",
        "auth_users: daftar akun (email, tanggal daftar, cara masuk). Password tidak bisa dan tidak ikut di-backup;",
        "  pengguna cukup memakai Lupa password atau masuk dengan Google lagi di proyek baru.",
        "",
        "Memulihkan ke proyek Supabase baru:",
        "1. Jalankan semua file supabase/migrations/*.sql dari repo GitHub, berurutan.",
        "2. Impor data/*.csv lewat Table Editor → Import data, sesuai urutan file di atas (kota & tag dulu, lalu kafe, dst).",
        "3. Unggah isi folder foto/ ke bucket cafe-photos dengan path yang sama.",
      ].join("\n")));

      zip.end();
      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `wfchunters-backup-${stamp.toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setResult({ ok: true, text: `Selesai: ${a.download} (${mb(blob.size)}).${failed.length ? ` ${failed.length} foto gagal diambil, daftarnya ada di foto-gagal.txt.` : ""}` });
    } catch (e) {
      setResult({ ok: false, text: `Backup berhenti: ${(e as Error).message}. Coba lagi; kalau berulang, kirim pesan ini ke pengembang.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name="inbox" className="h-5 w-5" /></span>
          <div>
            <h2 className="font-sans text-lg font-bold tracking-normal">Unduh backup (zip)</h2>
            <p className="mt-0.5 text-sm text-muted">Semua data kafe, menu, ulasan, pengguna, laporan, pesan, dan pengaturan, plus foto kafe. Simpan file zip-nya di tempat lain (Google Drive, laptop, atau Files di iPad).</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-3"><input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} disabled={busy} className="h-5 w-5 accent-brand" />Sertakan foto kafe</label>
          <label className={`flex items-center gap-3 ${withPhotos ? "" : "opacity-50"}`}><input type="checkbox" checked={withThumbs} onChange={(e) => setWithThumbs(e.target.checked)} disabled={busy || !withPhotos} className="h-5 w-5 accent-brand" />Sertakan thumbnail juga (tidak wajib, bisa dibuat ulang)</label>
        </div>
        <button type="button" onClick={run} disabled={busy} className="btn-primary min-h-12">
          <Icon name="inbox" className="h-4 w-4" />{busy ? "Membuat backup…" : "Buat & unduh backup"}
        </button>
        {busy && <p className="text-sm text-muted">Biarkan halaman ini terbuka sampai file zip terunduh.</p>}
      </div>

      {(steps.length > 0 || progress) && (
        <div className="card space-y-3 p-5" aria-live="polite">
          {progress && (
            <div>
              <div className="flex justify-between text-sm"><span className="font-semibold">Foto</span><span className="tabular-nums text-muted">{progress.done} / {progress.total}</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
            </div>
          )}
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label} className="flex justify-between gap-3 border-b border-tint py-1">
                <span className="truncate">{s.label}</span><span className={s.ok ? "text-muted" : "text-[#8a5a00]"}>{s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-ok/10 text-[#2f7049]" : "border border-red-200 bg-red-50 text-red-800"}`}>{result.text}</p>}
    </div>
  );
}
