import type { Patterns } from "@/lib/autoReview";
import { MIN_HISTORY } from "@/lib/autoReview";
import type { Settings } from "@/lib/settings";
import { saveAutoSettings } from "@/app/admin/rekomendasi/actions";
import SubmitButton from "./SubmitButton";

/** Setelan persetujuan otomatis + ringkasan kebiasaanmu saat menerima/menolak rekomendasi. */
export default function AutoReviewPanel({ p, settings }: { p: Patterns; settings: Settings }) {
  const edits = p.editRates.filter((e) => e.edited > 0).sort((a, b) => b.edited / b.total - a.edited / a.total);
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <form action={saveAutoSettings} className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-bold">Persetujuan otomatis</h2>
          <p className="mt-0.5 text-sm text-muted">
            Kiriman yang lolos semua cek wajib langsung tayang tanpa menunggumu. Yang tidak lolos tetap masuk antrean di bawah, lengkap dengan alasannya.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
          <input type="checkbox" name="auto_approve" defaultChecked={settings.auto_approve} className="h-4 w-4 accent-brand" />
          <span>
            <span className="block text-sm font-semibold">Langsung tayangkan kiriman yang lolos</span>
            <span className="block text-xs text-muted">Kamu dapat email setiap ada kafe yang tayang otomatis, dengan link untuk membatalkannya.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
          <input type="checkbox" name="auto_trust_new" defaultChecked={settings.auto_trust_new} className="h-4 w-4 accent-brand" />
          <span>
            <span className="block text-sm font-semibold">Termasuk author baru</span>
            <span className="block text-xs text-muted">Kalau tidak dicentang, kiriman pertama tiap author tetap kamu cek dulu.</span>
          </span>
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="auto_daily_limit" className="label">Maksimal per author per hari</label>
            <input id="auto_daily_limit" name="auto_daily_limit" type="number" min={1} max={20} defaultValue={settings.auto_daily_limit} className="input !w-28" />
          </div>
          <SubmitButton className="btn-primary min-h-11">Simpan setelan</SubmitButton>
        </div>
      </form>

      <section className="card p-5">
        <h2 className="text-lg font-bold">Kebiasaanmu menilai rekomendasi</h2>
        {p.decided === 0 ? (
          <p className="mt-2 text-sm text-muted">Belum ada rekomendasi yang kamu terima atau tolak. Ambang awal dipakai sampai ada riwayat.</p>
        ) : (
          <p className="mt-0.5 text-sm text-muted">
            Dari {p.decided} keputusanmu: {p.approved} diterima, {p.rejected} ditolak{p.autoCount ? `, ditambah ${p.autoCount} yang tayang otomatis` : ""}.
            {!p.reliable && ` Ambang belum dipelajari dari kebiasaanmu karena riwayat belum cukup (butuh ${MIN_HISTORY} keputusan, minimal 5 diterima).`}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Foto minimal", p.thresholds.photos],
            ["Aspek dinilai", p.thresholds.aspects],
            ["Huruf ulasan", p.thresholds.reviewLen],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-canvas px-2 py-3">
              <dd className="text-xl font-bold">{v}</dd>
              <dt className="text-xs text-muted">{l}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-xs text-muted">{p.reliable ? "Ambang diambil dari 80% kiriman yang biasa kamu terima." : "Ambang awal, akan menyesuaikan setelah riwayat cukup."}</p>

        {p.approved > 0 && p.rejected > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Rata-rata tengah</th><th className="font-medium">Foto</th><th className="font-medium">Aspek</th><th className="font-medium">Huruf ulasan</th><th className="font-medium">Menu</th></tr></thead>
              <tbody>
                {([["Diterima", p.medians.approved], ["Ditolak", p.medians.rejected]] as const).map(([l, m]) => (
                  <tr key={l} className="border-t border-line"><td className="py-1.5">{l}</td><td>{m.photos}</td><td>{m.aspects}</td><td>{m.reviewLen}</td><td>{m.menu}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!!edits.length && (
          <div className="mt-4">
            <p className="text-sm font-semibold">Yang sering kamu ubah setelah menerima</p>
            <ul className="mt-1 space-y-0.5 text-sm text-muted">
              {edits.slice(0, 4).map((e) => <li key={e.field}>{e.label}: {e.edited} dari {e.total} kiriman</li>)}
            </ul>
          </div>
        )}
        {!!p.rejectWords.length && (
          <div className="mt-4">
            <p className="text-sm font-semibold">Kata yang sering muncul di catatan penolakan</p>
            <p className="mt-1 flex flex-wrap gap-1.5">
              {p.rejectWords.map(([w, n]) => <span key={w} className="chip">{w} · {n}</span>)}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
