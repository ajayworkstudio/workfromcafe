import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { rupiah } from "@/lib/utils";
import { getPlans, getSettings } from "@/lib/settings";
import { createManualPayment } from "@/app/bayar/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import Icon from "@/components/Icon";
import type { Plan } from "@/lib/types";

export const metadata: Metadata = { title: "Langganan" };

const PERKS = [
  "Ulasan lengkap semua kafe",
  "Menu rekomendasi + harga + catatan",
  "Tips tempat duduk & jam terbaik",
  "Peta semua kafe Jawa Tengah",
  "Kafe baru setiap bulan",
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const [viewer, PLANS, settings, { err }] = await Promise.all([getViewer(), getPlans(), getSettings(), searchParams]);
  const manual = settings.manual_payment_enabled;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold md:text-5xl">Harga langganan</h1>
        <p className="mt-2 text-muted">Bayar lewat QRIS pakai DANA, GoPay, OVO, ShopeePay, atau m-banking.</p>
        {viewer.isPremium && (
          <p className="mt-4 inline-block rounded-full bg-ok/10 px-4 py-2 text-sm text-ok">
            Kamu sudah premium sampai {new Date(viewer.premiumUntil!).toLocaleDateString("id-ID")}. Bayar lagi = masa aktif ditambah.
          </p>
        )}
      </div>

      {!viewer.user && settings.trial_days > 0 && (
        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-4 text-white">
          <p><span className="font-semibold">Belum yakin?</span> <span className="text-white/70">Daftar dan pakai semua fitur gratis {settings.trial_days} hari.</span></p>
          <Link href="/masuk?daftar=1" className="btn bg-white text-ink hover:bg-tint">Coba gratis</Link>
        </div>
      )}

      {err && <p role="alert" className="mx-auto mt-6 max-w-md rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">{err}</p>}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {(Object.keys(PLANS) as Plan[]).map((key) => {
          const p = PLANS[key];
          const highlight = key === "yearly";
          return (
            <div key={key} className={`card flex flex-col p-6 ${highlight ? "!border-brand ring-4 ring-brand/10" : ""}`}>
              {highlight && <span className="mb-2 self-start rounded-full bg-gold/25 px-3 py-1 text-xs font-semibold text-[#8a5a00]">Paling hemat</span>}
              <h2 className="font-display text-2xl font-bold">{p.label}</h2>
              <p className="mt-2">
                <span className="font-display text-4xl font-bold">{rupiah(p.price)}</span>
                <span className="text-muted"> / {p.months === 1 ? "bulan" : "tahun"}</span>
              </p>
              <p className="mt-1 text-sm text-muted">{p.note}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {PERKS.map((x) => <li key={x} className="flex gap-2"><Icon name="check" className="h-5 w-5 shrink-0 text-brand" />{x}</li>)}
              </ul>
              <div className="mt-6">
                {viewer.user ? (
                  manual ? (
                    <form action={createManualPayment}>
                      <input type="hidden" name="plan" value={key} />
                      <SubmitButton className={`${highlight ? "btn-primary" : "btn-dark"} w-full`}>Langganan sekarang</SubmitButton>
                      <p className="mt-2 text-center text-xs text-muted">Bayar via QRIS, lalu konfirmasi lewat WhatsApp</p>
                    </form>
                  ) : (
                    <p className="rounded-xl bg-tint p-3 text-center text-sm text-muted">Pendaftaran langganan sedang ditutup sementara.</p>
                  )
                ) : (
                  <Link href="/masuk?next=/harga" className="btn-dark w-full">Masuk untuk berlangganan</Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card mt-8 p-5 text-sm text-muted">
        <p className="font-semibold text-ink">Belum mau langganan?</p>
        <p className="mt-1">Daftar gratis dan buka beberapa kafe secara penuh setiap bulan.</p>
      </div>
    </div>
  );
}
