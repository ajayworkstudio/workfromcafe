import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";

async function saveSettings(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const keys = ["price_monthly", "price_yearly", "free_unlock_limit_per_month"] as const;
  const rows = keys.map((key) => ({ key, value: String(Math.max(0, Math.round(Number(formData.get(key)) || 0))) }));
  if (Number(rows[0].value) < 1000 || Number(rows[1].value) < 1000)
    redirect(`/admin/pengaturan?err=${encodeURIComponent("Harga minimal Rp1.000 (batas Midtrans).")}`);
  const { error } = await supabase.from("app_settings").upsert(rows);
  revalidatePath("/", "layout");
  redirect(error ? `/admin/pengaturan?err=${encodeURIComponent(error.message)}` : `/admin/pengaturan?ok=${encodeURIComponent("Pengaturan disimpan. Langsung berlaku untuk pembayaran berikutnya.")}`);
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [sp, s] = await Promise.all([searchParams, getSettings()]);
  return (
    <>
      <PageHeader title="Pengaturan" description="Harga dan kuota bisa diubah kapan saja tanpa deploy ulang." />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveSettings} className="max-w-xl space-y-5">
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
