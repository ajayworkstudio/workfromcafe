import Link from "next/link";
import { ACTION_LABEL, PERIODS, SOURCE_LABEL, busiestWindow, change, sumActions, type CafeStats, type Source } from "@/lib/stats";

const n = (v: number) => v.toLocaleString("id-ID");

/** Pilihan periode 7 / 30 / 90 hari sebagai link (tetap jalan tanpa JavaScript). */
export function PeriodTabs({ days, hrefFor }: { days: number; hrefFor: (d: number) => string }) {
  return (
    <nav aria-label="Periode" className="flex gap-1.5">
      {PERIODS.map((d) => (
        <Link key={d} href={hrefFor(d)} aria-current={d === days ? "page" : undefined}
          className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${d === days ? "bg-ink text-white" : "border border-line bg-surface text-muted hover:text-ink"}`}>
          {d} hari
        </Link>
      ))}
    </nav>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  const c = change(now, before);
  if (c === null) return <span className="text-muted">belum ada pembanding</span>;
  if (c === 0) return <span className="text-muted">sama dengan periode sebelumnya</span>;
  return <span className={c > 0 ? "font-semibold text-ok" : "font-semibold text-[#b4533a]"}>{c > 0 ? "▲" : "▼"} {Math.abs(c)}% dari periode sebelumnya</span>;
}

/**
 * Semua angka statistik satu kafe. Angka langsung dari cafe_stats (tidak ada angka contoh);
 * kalau belum ada kunjungan sama sekali, yang tampil kalimat kosong, bukan grafik nol.
 */
export default function StatsPanel({ s, tone = "light" }: { s: CafeStats; tone?: "light" | "print" }) {
  const actions = sumActions(s);
  const totalSrc = Object.values(s.sources).reduce((a, b) => a + (b ?? 0), 0);
  const peak = busiestWindow(s.hours);
  const mobile = s.devices.hp ?? 0;
  const max = Math.max(1, ...s.daily.map((d) => d.views));
  const rate = s.views ? Math.round((actions / s.views) * 100) : 0;

  if (!s.views && !actions) {
    return (
      <p className="rounded-2xl border border-dashed border-mist bg-surface p-6 text-center text-muted">
        Belum ada kunjungan tercatat dalam {s.days} hari terakhir. Angka muncul di sini begitu halaman kafe ini dibuka orang.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`rounded-2xl p-4 ${tone === "print" ? "border border-line" : "bg-brand text-white"}`}>
          <dt className={`text-sm ${tone === "print" ? "text-muted" : "text-white/80"}`}>Dilihat</dt>
          <dd className="mt-1 text-3xl font-extrabold tracking-tight">{n(s.views)}</dd>
          <dd className={`mt-1 text-xs ${tone === "print" ? "" : "[&_*]:!text-white/85"}`}><Delta now={s.views} before={s.prev_views} /></dd>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <dt className="text-sm text-muted">Pengunjung unik</dt>
          <dd className="mt-1 text-3xl font-extrabold tracking-tight">{n(s.visitors)}</dd>
          <dd className="mt-1 text-xs"><Delta now={s.visitors} before={s.prev_visitors} /></dd>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <dt className="text-sm text-muted">Aksi (rute, menu, IG, bagikan)</dt>
          <dd className="mt-1 text-3xl font-extrabold tracking-tight">{n(actions)}</dd>
          <dd className="mt-1 text-xs text-muted">{rate}% pengunjung bertindak</dd>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <dt className="text-sm text-muted">Disimpan ke favorit</dt>
          <dd className="mt-1 text-3xl font-extrabold tracking-tight">{n(s.favorites)}</dd>
          <dd className="mt-1 text-xs text-muted">sepanjang waktu</dd>
        </div>
      </dl>

      {/* Tren harian: batang = tampilan per hari */}
      <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-sans text-base font-bold tracking-normal">Dilihat per hari</h3>
          <p className="text-xs text-muted">Puncak {n(max)} tampilan sehari</p>
        </div>
        <div className="mt-4 flex h-32 items-end gap-[2px]" role="img"
          aria-label={`Grafik tampilan harian ${s.days} hari terakhir, puncak ${max} tampilan`}>
          {s.daily.map((d) => (
            <div key={d.d} className="group relative flex h-full flex-1 items-end">
              <div className={`w-full rounded-t-[3px] ${d.views ? "bg-brand" : "bg-line"}`}
                style={{ height: `${Math.max(d.views ? 4 : 2, (d.views / max) * 100)}%` }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white group-hover:block">
                {new Date(d.d).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}: {d.views} dilihat
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>{new Date(s.daily[0]?.d).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
          <span>Hari ini</span>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <h3 className="font-sans text-base font-bold tracking-normal">Dari mana mereka datang</h3>
          <ul className="mt-3 space-y-2.5">
            {(Object.entries(s.sources) as [Source, number][]).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <li key={k}>
                <div className="flex justify-between gap-3 text-sm"><span>{SOURCE_LABEL[k] ?? k}</span><span className="font-semibold">{Math.round((v / totalSrc) * 100)}%</span></div>
                <div className="mt-1 h-2 rounded-full bg-tint"><div className="h-2 rounded-full bg-brand" style={{ width: `${(v / totalSrc) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <h3 className="font-sans text-base font-bold tracking-normal">Tentang pengunjungnya</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between gap-3"><span className="text-muted">Membuka dari HP</span><b>{s.views ? Math.round((mobile / s.views) * 100) : 0}%</b></li>
            <li className="flex justify-between gap-3"><span className="text-muted">Pengguna terdaftar WFC Hunters</span><b>{s.views ? Math.round((s.logged_in / s.views) * 100) : 0}%</b></li>
            {peak && <li className="flex justify-between gap-3"><span className="text-muted">Jam paling ramai dilihat</span><b>{peak} WIB</b></li>}
          </ul>
          {!!s.cities.length && (
            <>
              <p className="mt-4 text-sm text-muted">Kota asal pengunjung</p>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {s.cities.map((c) => <span key={c.city} className="chip">{c.city} · {n(c.n)}</span>)}
              </p>
            </>
          )}
        </section>
      </div>

      {!!actions && (
        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <h3 className="font-sans text-base font-bold tracking-normal">Yang dilakukan setelah melihat</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {(Object.entries(s.actions) as [keyof typeof ACTION_LABEL, number][]).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3 rounded-xl bg-tint px-3 py-2.5 text-sm"><span>{ACTION_LABEL[k] ?? k}</span><b>{n(v)}</b></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
