import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, normalizeWa } from "@/lib/settings";
import QrisUploader from "@/components/admin/QrisUploader";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";

async function saveSettings(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const keys = ["price_monthly", "price_yearly", "free_unlock_limit_per_month", "trial_days"] as const;
  const rows: { key: string; value: string }[] = keys.map((key) => ({ key, value: String(Math.max(0, Math.round(Number(formData.get(key)) || 0))) }));
  if (Number(rows[0].value) < 1000 || Number(rows[1].value) < 1000)
    redirect(`/admin/pengaturan?err=${encodeURIComponent("Harga minimal Rp1.000.")}`);
  const wa = normalizeWa(String(formData.get("whatsapp_number") || ""));
  if (wa && !/^62\d{8,13}$/.test(wa)) redirect(`/admin/pengaturan?err=${encodeURIComponent("Nomor WhatsApp tidak valid. Contoh: 081339646353")}`);
  rows.push(
    { key: "manual_payment_enabled", value: formData.get("manual_payment_enabled") === "on" ? "true" : "false" },
    { key: "whatsapp_number", value: wa },
    { key: "qris_name", value: String(formData.get("qris_name") || "DANA Bisnis").trim().slice(0, 40) },
    { key: "qris_merchant_name", value: String(formData.get("qris_merchant_name") || "").trim().slice(0, 60) },
    { key: "qris_image_url", value: String(formData.get("qris_image_url") || "") },
  );
  const { error } = await supabase.from("app_settings").upsert(rows);
  revalidatePath("/", "layout");
  redirect(error ? `/admin/pengaturan?err=${encodeURIComponent(error.message)}` : `/admin/pengaturan?ok=${encodeURIComponent("Pengaturan disimpan. Langsung berlaku untuk pembayaran berikutnya.")}`);
}

async function saveFreeMode(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const on = formData.get("free_mode") === "on";
  const community = String(formData.get("community_url") || "").trim();
  if (community && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(community))
    redirect(`/admin/pengaturan?err=${encodeURIComponent("Link komunitas harus link WhatsApp, contoh: https://chat.whatsapp.com/…")}`);
  // Buang parameter pelacak (?utm_…, fbclid) dari link yang disalin dari Instagram
  const cleanCommunity = community ? community.split("?")[0] : "";
  const { error } = await supabase.from("app_settings").upsert([
    { key: "free_mode", value: on ? "true" : "false" },
    { key: "community_url", value: cleanCommunity },
  ]);
  revalidatePath("/", "layout");
  redirect(error
    ? `/admin/pengaturan?err=${encodeURIComponent(error.message)}`
    : `/admin/pengaturan?ok=${encodeURIComponent(on ? "Mode gratis aktif. Semua konten terbuka untuk semua orang." : "Mode langganan aktif. Halaman harga, trial, dan kunci konten muncul lagi.")}`);
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  return (
    <>
      <PageHeader title="Pengaturan" description="Harga dan kuota bisa diubah kapan saja tanpa deploy ulang." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveFreeMode} className="card mb-5 max-w-xl space-y-4 p-5 md:p-6">
        <h2 className="text-lg font-bold">Mode aplikasi &amp; komunitas</h2>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
          <input type="checkbox" name="free_mode" defaultChecked={s.free_mode} className="h-4 w-4 accent-brand" />
          <span>
            <span className="block text-sm font-semibold">Semua fitur gratis</span>
            <span className="block text-xs text-muted">Ulasan lengkap, menu, dan peta terbuka untuk semua orang. Halaman harga, trial, dan tombol langganan disembunyikan.</span>
          </span>
        </label>
        <div>
          <label htmlFor="community_url" className="label">Link komunitas WhatsApp</label>
          <input id="community_url" name="community_url" type="url" defaultValue={s.community_url} placeholder="https://chat.whatsapp.com/…" className="input" />
          <p className="mt-1.5 text-xs text-muted">Tampil di header, beranda, halaman Jadi author, Akun, dan footer. Kosongkan untuk menyembunyikan.</p>
        </div>
        <SubmitButton>Simpan</SubmitButton>
      </form>
      <form action={saveSettings} className={`max-w-xl space-y-5 ${s.free_mode ? "opacity-60" : ""}`}>
        {s.free_mode && <p className="text-sm text-muted">Pengaturan di bawah baru dipakai lagi saat mode gratis dimatikan.</p>}
        <section className="card space-y-4 p-5 md:p-6">
          <h2 className="text-lg font-bold">Harga langganan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Money id="price_monthly" label="Bulanan" value={s.price_monthly} />
            <Money id="price_yearly" label="Tahunan" value={s.price_yearly} />
          </div>
          <p className="text-sm text-muted">Pelanggan yang sudah membayar tidak terpengaruh. Harga baru berlaku untuk transaksi berikutnya.</p>
        </section>
        <section className="card space-y-4 p-5 md:p-6">
          <h2 className="text-lg font-bold">Member gratis</h2>
          <div className="max-w-[200px]">
            <label htmlFor="free_unlock_limit_per_month" className="label">Kafe gratis per bulan</label>
            <input id="free_unlock_limit_per_month" name="free_unlock_limit_per_month" type="number" min={0} max={50} defaultValue={s.free_unlock_limit_per_month} className="input" />
          </div>
          <p className="text-sm text-muted">Jumlah kafe yang bisa dibuka penuh oleh member tanpa langganan. Isi 0 untuk mematikan.</p>
          <div className="max-w-[200px]">
            <label htmlFor="trial_days" className="label">Trial gratis (hari)</label>
            <input id="trial_days" name="trial_days" type="number" min={0} max={60} defaultValue={s.trial_days} className="input" />
          </div>
          <p className="text-sm text-muted">Akun baru otomatis dapat akses penuh selama ini. Isi 0 untuk mematikan trial.</p>
        </section>
        <section className="card space-y-4 p-5 md:p-6">
          <h2 className="text-lg font-bold">Pembayaran manual lewat QRIS</h2>
          <p className="-mt-2 text-sm text-muted">Pelanggan scan QRIS, transfer dengan kode unik, lalu konfirmasi ke WhatsApp. Kamu setujui di menu Pelanggan.</p>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
            <input type="checkbox" name="manual_payment_enabled" defaultChecked={s.manual_payment_enabled} className="h-4 w-4 accent-brand" />
            <span><span className="block text-sm font-semibold">Terima langganan baru</span><span className="block text-xs text-muted">Kalau dimatikan, tombol langganan di halaman Harga ditutup sementara</span></span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="whatsapp_number" className="label">Nomor WhatsApp konfirmasi</label>
              <input id="whatsapp_number" name="whatsapp_number" inputMode="tel" defaultValue={s.whatsapp_number.replace(/^62/, "0")} className="input" />
            </div>
            <div>
              <label htmlFor="qris_name" className="label">Nama QRIS</label>
              <input id="qris_name" name="qris_name" defaultValue={s.qris_name} placeholder="DANA Bisnis" className="input" />
            </div>
          </div>
          <div>
            <label htmlFor="qris_merchant_name" className="label">Nama penerima di QRIS</label>
            <input id="qris_merchant_name" name="qris_merchant_name" defaultValue={s.qris_merchant_name} placeholder="Nama yang tertulis di QRIS" className="input" />
            <p className="mt-1.5 text-xs text-muted">Ditampilkan ke pelanggan supaya mereka yakin membayar ke tujuan yang benar.</p>
          </div>
          <QrisUploader initial={s.qris_image_url} />
        </section>
        <SubmitButton>Simpan pengaturan</SubmitButton>
      </form>
    </>
  );
}

function Money({ id, label, value }: { id: string; label: string; value: number }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex items-center rounded-xl border border-line bg-surface focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
        <span className="pl-3.5 text-sm text-muted">Rp</span>
        <input id={id} name={id} type="number" min={1000} step={500} defaultValue={value} required className="w-full bg-transparent px-2 py-2.5 text-sm outline-none tabular-nums" />
      </div>
    </div>
  );
}
