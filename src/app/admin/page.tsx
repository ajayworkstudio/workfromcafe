import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/admin/PageHeader";
import Icon from "@/components/Icon";
import { rupiah } from "@/lib/utils";

type Stats = { cafes: number; cafes_draft: number; users: number; active_subs: number; revenue_month: number; revenue_total: number; expiring_7d: number };

const STATUS: Record<string, string> = { paid: "Lunas", pending: "Menunggu", failed: "Gagal", expired: "Kedaluwarsa" };

export default async function AdminHome() {
  const supabase = await createClient();
  const [{ data: stats }, { data: recent }, { count: pendingManual }, { count: pendingSubs }, { count: unreadMsgs }] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase.from("payments").select("order_id,plan,amount,status,created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("method", "manual").eq("status", "pending"),
    supabase.from("cafe_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);
  const s = (stats ?? {}) as Stats;

  return (
    <>
      <PageHeader title="Ringkasan" description="Kondisi aplikasi hari ini."
        action={<Link href="/admin/kafe/baru" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Tambah kafe</Link>} />

      {!!pendingSubs && (
        <Link href="/admin/rekomendasi" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-5 py-4 hover:bg-brand-soft/70">
          <span><span className="font-semibold">{pendingSubs} rekomendasi kafe dari author menunggu review.</span></span>
          <span className="btn-dark !py-1.5 text-sm">Review</span>
        </Link>
      )}
      {!!unreadMsgs && (
        <Link href="/admin/pesan" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 hover:border-brand">
          <span className="font-semibold">{unreadMsgs} pesan baru dari kotak kontak.</span>
          <span className="btn-dark !py-1.5 text-sm">Baca</span>
        </Link>
      )}
      {!!pendingManual && (
        <Link href="/admin/pelanggan" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-gold/60 bg-gold/10 px-5 py-4 hover:bg-gold/20">
          <span><span className="font-semibold">{pendingManual} pembayaran QRIS menunggu konfirmasi.</span> <span className="text-muted">Cek mutasi lalu setujui.</span></span>
          <span className="btn-dark !py-1.5 text-sm">Lihat</span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-ink p-5 text-white">
          <p className="text-sm text-white/60">Pendapatan bulan ini</p>
          <p className="mt-1 font-display text-3xl font-bold">{rupiah(s.revenue_month ?? 0)}</p>
          <p className="mt-1 text-sm text-white/60">Total {rupiah(s.revenue_total ?? 0)}</p>
        </div>
        <Stat label="Pelanggan aktif" value={s.active_subs} note={s.expiring_7d ? `${s.expiring_7d} berakhir dalam 7 hari` : "Tidak ada yang segera berakhir"} href="/admin/pelanggan" />
        <Stat label="Kafe" value={s.cafes} note={s.cafes_draft ? `${s.cafes_draft} masih draf` : "Semua sudah tayang"} href="/admin/kafe" />
        <Stat label="Pengguna terdaftar" value={s.users} note="Lihat daftar pengguna" href="/admin/pengguna" />
      </div>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Transaksi terbaru</h2>
      </div>
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs font-medium text-muted">
            <tr><th className="p-3">Order</th><th className="p-3">Paket</th><th className="p-3">Nominal</th><th className="p-3">Status</th><th className="p-3">Waktu</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(recent ?? []).map((p) => (
              <tr key={p.order_id}>
                <td className="p-3 font-mono text-xs text-muted">{p.order_id}</td>
                <td className="p-3">{p.plan === "yearly" ? "Tahunan" : "Bulanan"}</td>
                <td className="p-3 tabular-nums">{rupiah(p.amount)}</td>
                <td className="p-3"><span className={`chip ${p.status === "paid" ? "!bg-ok/10 !text-ok" : ""}`}>{STATUS[p.status] ?? p.status}</span></td>
                <td className="p-3 text-muted">{new Date(p.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!recent?.length && <p className="p-5 text-muted">Belum ada transaksi. Transaksi muncul di sini setelah ada yang berlangganan.</p>}
      </div>
    </>
  );
}

function Stat({ label, value, note, href }: { label: string; value?: number; note: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value ?? 0}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </>
  );
  return href
    ? <Link href={href} className="card block p-5 transition-colors hover:border-mist">{body}</Link>
    : <div className="card p-5">{body}</div>;
}
