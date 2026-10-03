import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { PLAN_META, getSettings, normalizeWa } from "@/lib/settings";
import CopyButton from "@/components/CopyButton";
import Icon from "@/components/Icon";
import { APP_NAME, rupiah } from "@/lib/utils";

export const metadata: Metadata = { title: "Bayar via QRIS", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ManualPaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const viewer = await getViewer();
  if (!viewer.user) redirect(`/masuk?next=/bayar/${orderId}`);

  const supabase = await createClient();
  const [{ data: p }, settings] = await Promise.all([
    supabase.from("payments").select("order_id,plan,amount,status,method,created_at").eq("order_id", orderId).maybeSingle(),
    getSettings(),
  ]);
  if (!p || p.method !== "manual") notFound();

  const plan = PLAN_META[p.plan as keyof typeof PLAN_META];
  const waText = [
    `Halo, saya sudah bayar langganan ${APP_NAME}.`,
    ``,
    `Kode tagihan: ${p.order_id}`,
    `Paket: ${plan.label}`,
    `Nominal: ${rupiah(p.amount)}`,
    `Email akun: ${viewer.user.email}`,
    ``,
    `Bukti transfer saya lampirkan.`,
  ].join("\n");
  const waUrl = `https://wa.me/${normalizeWa(settings.whatsapp_number)}?text=${encodeURIComponent(waText)}`;

  if (p.status === "paid") {
    return (
      <Shell>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/10 text-ok"><Icon name="check" className="h-7 w-7" /></div>
        <h1 className="mt-4 text-center text-3xl font-extrabold">Pembayaran diterima</h1>
        <p className="mt-2 text-center text-muted">Langganan {plan.label.toLowerCase()} kamu sudah aktif.</p>
        <Link href="/kafe" className="btn-primary mt-6 w-full">Mulai jelajah kafe</Link>
      </Shell>
    );
  }
  if (p.status !== "pending") {
    return (
      <Shell>
        <h1 className="text-center text-3xl font-extrabold">Tagihan tidak berlaku</h1>
        <p className="mt-2 text-center text-muted">Tagihan ini ditolak atau sudah kedaluwarsa. Kalau kamu sudah transfer, hubungi kami lewat WhatsApp.</p>
        <div className="mt-6 grid gap-2">
          <a href={waUrl} target="_blank" rel="noopener" className="btn bg-[#1f8f4e] text-white hover:bg-[#187540]">Hubungi via WhatsApp</a>
          <Link href="/harga" className="btn-ghost">Buat tagihan baru</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-3xl font-extrabold">Bayar via QRIS</h1>
      <p className="mt-1 text-muted">Langganan {plan.label.toLowerCase()} · kode {p.order_id}</p>

      <div className="mt-6 rounded-2xl bg-ink p-5 text-white">
        <p className="text-sm text-white/60">Transfer tepat sejumlah</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-4xl font-bold tabular-nums">{rupiah(p.amount)}</p>
          <CopyButton value={String(p.amount)} label="Salin nominal" />
        </div>
        <p className="mt-2 text-sm text-white/60">Tiga digit terakhir adalah kode unik supaya pembayaranmu cepat dikenali.</p>
      </div>

      {settings.qris_image_url ? (
        <figure className="mt-5 rounded-2xl border border-line bg-white p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={settings.qris_image_url} alt={`QRIS ${settings.qris_name}`} className="mx-auto w-full max-w-[320px]" />
          <figcaption className="mt-2 text-sm text-muted">
            {settings.qris_merchant_name && <span className="block font-semibold text-ink">Penerima: {settings.qris_merchant_name}</span>}
            Bisa dibayar dengan DANA, GoPay, OVO, ShopeePay, atau m-banking.
          </figcaption>
        </figure>
      ) : (
        <p className="mt-5 rounded-2xl bg-tint p-4 text-sm text-muted">Gambar QRIS belum diunggah admin. Hubungi kami lewat WhatsApp untuk instruksi pembayaran.</p>
      )}

      <ol className="mt-6 space-y-3 text-sm">
        {[
          settings.qris_merchant_name ? `Scan QRIS di atas. Pastikan nama penerima yang muncul ${settings.qris_merchant_name}.` : "Scan QRIS di atas dengan aplikasi pembayaran apa saja.",
          `Masukkan nominal persis ${rupiah(p.amount)}, lalu bayar.`,
          "Simpan screenshot bukti pembayaran.",
          "Tekan tombol di bawah untuk kirim konfirmasi lewat WhatsApp, lalu lampirkan screenshot-nya.",
        ].map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
            <span className="pt-0.5">{t}</span>
          </li>
        ))}
      </ol>

      <a href={waUrl} target="_blank" rel="noopener" className="btn mt-6 w-full bg-[#1f8f4e] !py-3 text-white hover:bg-[#187540]">
        Konfirmasi lewat WhatsApp
      </a>
      <p className="mt-3 text-center text-sm text-muted">
        Premium aktif setelah pembayaranmu dicek, biasanya kurang dari 1×24 jam. Status bisa dilihat di <Link href="/akun" className="font-semibold text-brand hover:underline">halaman Akun</Link>.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-10">{children}</div>;
}
