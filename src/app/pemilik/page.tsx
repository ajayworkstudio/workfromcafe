import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmButton from "@/components/admin/ConfirmButton";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getSettings, normalizeWa } from "@/lib/settings";
import { rupiah } from "@/lib/utils";
import {
  CAMPAIGN_STATUS, MIN_BID, TARGET_LABEL, activeSub,
  type AdCampaign, type CafePlan, type CafeSubscription, type TargetType,
} from "@/lib/ads";
import {
  addTarget, claimCafe, createCampaign, deleteCampaign, deleteTarget, requestPlan, setCampaignStatus, updateBid,
} from "./actions";
import TopupBox from "./TopupBox";

export const metadata: Metadata = { title: "Kafe saya", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type OwnedCafe = {
  id: string;
  cafe_id: string;
  verified_at: string | null;
  cafe: { id: string; name: string; slug: string; area: string | null; city: { name: string; slug: string } | null } | null;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ kafe?: string; ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!viewer.user) redirect("/masuk?next=/pemilik");
  const supabase = await createClient();
  const wa = normalizeWa(settings.whatsapp_number);
  const email = viewer.user.email ?? "";

  const { data: ownRows, error: ownErr } = await supabase
    .from("cafe_owners")
    .select("id,cafe_id,verified_at,cafe:cafes(id,name,slug,area,city:cities(name,slug))")
    .eq("user_id", viewer.user.id)
    .order("created_at");

  if (ownErr) {
    return (
      <Shell>
        <p role="alert" className="card p-5 text-sm">Halaman pemilik belum bisa dibuka. Admin perlu menjalankan migrasi <code>0025_iklan_kafe.sql</code> di Supabase.</p>
      </Shell>
    );
  }

  const owned = (ownRows ?? []) as unknown as OwnedCafe[];
  const verified = owned.filter((o) => o.verified_at && o.cafe);
  const pending = owned.filter((o) => !o.verified_at && o.cafe);
  const current = verified.find((o) => o.cafe_id === sp.kafe) ?? verified[0] ?? null;

  // Daftar kafe untuk diklaim (hanya yang tayang dan belum diajukan akun ini)
  const { data: allCafes } = await supabase
    .from("cafes")
    .select("id,name,area,city:cities(name)")
    .eq("is_published", true)
    .order("name");
  const claimable = ((allCafes ?? []) as unknown as { id: string; name: string; area: string | null; city: { name: string } | null }[])
    .filter((c) => !owned.some((o) => o.cafe_id === c.id));

  const claimForm = (
    <form action={claimCafe} className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">{verified.length ? "Klaim kafe lain" : "Klaim kafemu"}</h2>
      <p className="text-sm text-muted">
        Pilih kafe yang kamu kelola. Setelah aku cek bukti kepemilikannya, kamu bisa memilih paket dan memasang iklan di sini.
      </p>
      {claimable.length ? (
        <>
          <div>
            <label htmlFor="claim" className="label">Kafe</label>
            <select id="claim" name="cafe_id" required className="input" defaultValue="">
              <option value="" disabled>Pilih kafe</option>
              {claimable.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.area ? `, ${c.area}` : ""}{c.city ? ` (${c.city.name})` : ""}</option>
              ))}
            </select>
          </div>
          <SubmitButton>Ajukan klaim</SubmitButton>
        </>
      ) : (
        <p className="text-sm">
          Kafemu belum ada di WFC Hunters? <Link href="/kontak" className="font-semibold text-brand hover:underline">Kabari aku lewat halaman kontak</Link> supaya kafenya ditambahkan dulu.
        </p>
      )}
    </form>
  );

  const pendingList = !!pending.length && (
    <section className="card divide-y divide-line">
      {pending.map((p) => {
        const text = `Halo, saya pemilik ${p.cafe!.name}. Saya sudah mengajukan klaim kafe di WFC Hunters dengan email ${email}. Bukti kepemilikan saya lampirkan.`;
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.cafe!.name}</p>
              <p className="text-sm text-muted">Menunggu verifikasi</p>
            </div>
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener"
              className="btn bg-[#1f8f4e] min-h-11 text-sm text-white hover:bg-[#187540]">
              <Icon name="whatsapp" className="h-4 w-4" />Kirim bukti
            </a>
          </div>
        );
      })}
    </section>
  );

  if (!current) {
    return (
      <Shell>
        <Flash ok={sp.ok} err={sp.err} />
        <h1 className="text-3xl font-extrabold">Kafe saya</h1>
        <p className="mt-1 text-muted">Untuk pemilik dan pengelola kafe yang sudah ada di WFC Hunters.</p>
        <div className="mt-6 space-y-4">
          {pendingList}
          {claimForm}
        </div>
      </Shell>
    );
  }

  const cafeId = current.cafe_id;
  const cafe = current.cafe!;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();

  const [
    { data: subsRaw }, { data: plansRaw }, { data: wallet }, { data: campRaw }, { data: quality },
    { data: txs }, { count: impressions }, { data: clicks }, { data: cities }, { data: tags },
  ] = await Promise.all([
    supabase.from("cafe_subscriptions").select("*").eq("cafe_id", cafeId).order("created_at", { ascending: false }),
    supabase.from("cafe_plans").select("*").order("id"),
    supabase.from("ad_wallets").select("balance").eq("cafe_id", cafeId).maybeSingle(),
    supabase.from("ad_campaigns").select("*,ad_targets(*)").eq("cafe_id", cafeId).order("created_at"),
    supabase.from("cafe_quality_scores").select("quality_score").eq("cafe_id", cafeId).maybeSingle(),
    supabase.from("wallet_transactions").select("id,type,amount,balance_after,note,created_at").eq("cafe_id", cafeId)
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("ad_impressions").select("id", { count: "exact", head: true }).eq("cafe_id", cafeId).gte("created_at", since),
    supabase.from("ad_clicks").select("charged,is_valid").eq("cafe_id", cafeId).gte("created_at", since),
    supabase.from("cities").select("slug,name").eq("is_active", true).order("name"),
    supabase.from("tags").select("name").order("name"),
  ]);

  const subs = (subsRaw ?? []) as CafeSubscription[];
  const plans = (plansRaw ?? []) as CafePlan[];
  const sub = activeSub(subs);
  const plan = plans.find((p) => p.id === sub?.plan_id) ?? null;
  const pendingSub = subs.find((s) => s.status === "pending") ?? null;
  const pendingPlan = plans.find((p) => p.id === pendingSub?.plan_id) ?? null;
  const campaigns = (campRaw ?? []) as AdCampaign[];
  const balance = wallet?.balance ?? 0;
  const validClicks = (clicks ?? []).filter((c) => c.is_valid);
  const spent = validClicks.reduce((a, c) => a + c.charged, 0);
  const canBid = !!plan?.can_bid;
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  const suggestions: Record<TargetType, string[]> = {
    city: (cities ?? []).map((c) => c.slug),
    area: cafe.area ? [cafe.area.toLowerCase()] : [],
    tag: (tags ?? []).map((t) => t.name.toLowerCase()),
    keyword: [],
  };

  const planWaText = pendingSub && pendingPlan && [
    `Halo, saya sudah bayar paket WFC Hunters untuk kafe saya.`,
    ``,
    `Kafe: ${cafe.name}`,
    `Paket: ${pendingPlan.name}`,
    `Nominal: ${rupiah(pendingPlan.monthly_price)}`,
    `Email akun: ${email}`,
    ``,
    `Bukti transfer QRIS saya lampirkan.`,
  ].join("\n");

  const qris = (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-tint p-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={settings.qris_image_url} alt={`QRIS ${settings.qris_name} ${settings.qris_merchant_name}`} className="w-48 max-w-full rounded-lg bg-white p-2" />
      <p className="text-sm text-muted">{settings.qris_name}{settings.qris_merchant_name ? `, a.n. ${settings.qris_merchant_name}` : ""}</p>
    </div>
  );

  return (
    <Shell>
      <Flash ok={sp.ok} err={sp.err} />

      {verified.length > 1 && (
        <nav aria-label="Pilih kafe" className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {verified.map((o) => (
            <Link key={o.id} href={`/pemilik?kafe=${o.cafe_id}`} aria-current={o.cafe_id === cafeId ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-3 text-sm font-medium ${o.cafe_id === cafeId ? "bg-brand text-white" : "border border-line bg-surface text-muted hover:text-ink"}`}>
              {o.cafe!.name}
            </Link>
          ))}
        </nav>
      )}

      {/* Fokus layar: kafe yang dikelola dan sisa saldo iklannya */}
      <section className="rounded-[2rem] bg-brand p-6 text-white">
        <p className="text-sm text-white/80">Kafe saya</p>
        <h1 className="mt-1 break-words text-3xl font-extrabold tracking-tight">{cafe.name}</h1>
        <p className="mt-1 text-sm text-white/80">{[cafe.area, cafe.city?.name].filter(Boolean).join(", ")}</p>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">Saldo iklan</p>
            <p className="text-4xl font-extrabold tracking-tight">{rupiah(balance)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#isi-saldo" className="btn bg-white text-brand hover:bg-foam">Isi saldo</a>
            <Link href={`/kafe/${cafe.slug}`} className="btn border border-white/40 text-white hover:bg-white/10">Lihat halaman kafe</Link>
          </div>
        </div>
      </section>

      {/* Paket */}
      <section className="mt-6">
        <h2 className="text-xl font-bold">Paket</h2>
        {plan && sub ? (
          <div className="card mt-3 flex flex-wrap items-center gap-3 p-5">
            <div className="flex-1">
              <p className="text-lg font-bold">{plan.name}</p>
              <p className="text-sm text-muted">Aktif sampai {fmtDate(sub.ends_at!)} · maksimal {plan.max_active_campaigns} kampanye berjalan</p>
            </div>
            <span className="chip !bg-ok/10 !text-ok">Aktif</span>
          </div>
        ) : pendingSub && pendingPlan ? (
          <div className="card mt-3 space-y-4 p-5">
            <div>
              <p className="text-lg font-bold">{pendingPlan.name}, {rupiah(pendingPlan.monthly_price)} per bulan</p>
              <p className="text-sm text-muted">Menunggu pembayaran. Scan QRIS ini, lalu kirim bukti transfernya. Paket aktif setelah aku cek.</p>
            </div>
            {qris}
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(planWaText!)}`} target="_blank" rel="noopener"
              className="btn w-full bg-[#1f8f4e] text-white hover:bg-[#187540]">
              <Icon name="whatsapp" className="h-4 w-4" />Kirim bukti via WhatsApp
            </a>
            <p className="text-sm text-muted">Salah pilih paket? Bilang saja di chat WhatsApp itu, nanti aku ganti.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">
              Tanpa paket, kafemu tetap tampil seperti biasa. Paket berbayar membuka slot Sponsored dan menambah bonus saldo iklan tiap bulan.
            </p>
            <ul className="card divide-y divide-line">
              {plans.filter((p) => p.can_bid).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.name} <span className="font-normal text-muted">· {rupiah(p.monthly_price)}/bulan</span></p>
                    <p className="text-sm text-muted">Bonus saldo {rupiah(p.bonus_ad_credit)} · {p.max_active_campaigns} kampanye berjalan</p>
                  </div>
                  <form action={requestPlan}>
                    <input type="hidden" name="cafe_id" value={cafeId} />
                    <input type="hidden" name="plan_id" value={p.id} />
                    <SubmitButton className="btn-ghost min-h-11 text-sm">Pilih {p.name}</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Ringkasan 30 hari */}
      <section className="mt-8">
        <h2 className="text-xl font-bold">30 hari terakhir</h2>
        {impressions ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Tampil" value={impressions.toLocaleString("id-ID")} />
            <Stat label="Diklik" value={validClicks.length.toLocaleString("id-ID")} />
            <Stat label="Rasio klik" value={`${((validClicks.length / impressions) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`} />
            <Stat label="Terpakai" value={rupiah(spent)} />
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">Iklanmu belum pernah tampil. Angka tampil, klik, dan biaya muncul di sini setelah kampanye berjalan.</p>
        )}
      </section>

      {/* Kampanye */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold">Kampanye iklan</h2>
          {plan && <p className="text-sm text-muted">{activeCount} dari {plan.max_active_campaigns} berjalan</p>}
        </div>

        <details className="card mt-3 p-5 text-sm">
          <summary className="cursor-pointer font-semibold">Cara urutan Sponsored ditentukan</summary>
          <div className="mt-3 space-y-2 text-muted">
            <p>Tiap kali orang membuka halaman yang kamu targetkan, kafe-kafe yang ikut bersaing diurutkan dari tawaran per klik dikali skor kualitas.</p>
            <p>Skor kualitas diambil dari rating, ulasan kurator, dan seberapa sering iklanmu diklik. Jadi kafe yang bagus bisa di atas walau tawarannya lebih kecil.</p>
            <p>Kamu hanya bayar saat iklan diklik, sebesar yang cukup untuk mengalahkan kafe di bawahmu, tidak pernah lebih dari tawaranmu.</p>
            <p className="text-ink">
              Skor kualitas kafemu: <b>{quality ? Number(quality.quality_score).toLocaleString("id-ID", { minimumFractionDigits: 2 }) : "belum dinilai (dihitung 0,50)"}</b> dari 1.
            </p>
          </div>
        </details>

        {!canBid && (
          <p className="mt-3 rounded-xl bg-tint px-4 py-3 text-sm">Pilih paket dulu supaya kampanye bisa dibuat dan ikut lelang.</p>
        )}

        <div className="mt-3 space-y-4">
          {campaigns.map((c) => (
            <article key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-lg font-bold">{c.name}</h3>
                  <p className="text-sm text-muted">Budget harian {rupiah(c.daily_budget)}</p>
                </div>
                <span className={`chip ${c.status === "active" ? "!bg-ok/10 !text-ok" : c.status === "out_of_budget" ? "!bg-red-50 !text-red-800" : ""}`}>
                  {CAMPAIGN_STATUS[c.status]}
                </span>
              </div>

              {c.ad_targets.length ? (
                <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                  {c.ad_targets.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 p-3">
                      <p className="min-w-0 flex-1 text-sm">
                        <span className="text-muted">{TARGET_LABEL[t.target_type]}:</span> <b className="break-words">{t.target_value}</b>
                      </p>
                      <form action={updateBid} className="flex items-center gap-1.5">
                        <input type="hidden" name="cafe_id" value={cafeId} />
                        <input type="hidden" name="id" value={t.id} />
                        <label htmlFor={`bid-${t.id}`} className="sr-only">Tawaran per klik untuk {t.target_value}</label>
                        <input id={`bid-${t.id}`} name="max_bid" inputMode="numeric" defaultValue={t.max_bid} className="input !w-28 min-h-11 text-sm" />
                        <SubmitButton className="btn-ghost min-h-11 !px-3 text-sm">Simpan</SubmitButton>
                      </form>
                      <form action={deleteTarget}>
                        <input type="hidden" name="cafe_id" value={cafeId} />
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmButton message={`Hapus target ${t.target_value}?`} pendingText="…" className="btn-ghost min-h-11 !px-3">
                          <Icon name="trash" className="h-4 w-4" /><span className="sr-only">Hapus target {t.target_value}</span>
                        </ConfirmButton>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl bg-tint px-4 py-3 text-sm">Belum ada target. Tambahkan minimal satu supaya kampanye ini bisa tampil.</p>
              )}

              <form action={addTarget} className="mt-4 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_8rem_auto] sm:items-end">
                <input type="hidden" name="cafe_id" value={cafeId} />
                <input type="hidden" name="campaign_id" value={c.id} />
                <div>
                  <label htmlFor={`type-${c.id}`} className="label">Target</label>
                  <select id={`type-${c.id}`} name="target_type" className="input" defaultValue="area">
                    {(Object.keys(TARGET_LABEL) as TargetType[]).map((k) => <option key={k} value={k}>{TARGET_LABEL[k]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`val-${c.id}`} className="label">Isi</label>
                  <input id={`val-${c.id}`} name="target_value" required list={`sug-${c.id}`} placeholder={cafe.area?.toLowerCase() || "kafe kerja"} className="input" />
                  <datalist id={`sug-${c.id}`}>
                    {[...suggestions.area, ...suggestions.city, ...suggestions.tag].map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label htmlFor={`nb-${c.id}`} className="label">Per klik</label>
                  <input id={`nb-${c.id}`} name="max_bid" inputMode="numeric" required defaultValue={2000} className="input" />
                </div>
                <SubmitButton className="btn-ghost">Tambah</SubmitButton>
              </form>
              <p className="mt-1.5 text-xs text-muted">Tawaran minimal {rupiah(MIN_BID)} per klik. Saran isi: area kafemu, slug kota, atau nama tag.</p>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <form action={setCampaignStatus}>
                  <input type="hidden" name="cafe_id" value={cafeId} />
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="status" value={c.status === "active" ? "paused" : "active"} />
                  <SubmitButton className="btn-ghost min-h-11 text-sm">{c.status === "active" ? "Jeda" : "Jalankan"}</SubmitButton>
                </form>
                <form action={deleteCampaign}>
                  <input type="hidden" name="cafe_id" value={cafeId} />
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton message={`Hapus kampanye ${c.name} beserta targetnya?`} className="btn min-h-11 text-sm border border-red-200 bg-surface text-red-700 hover:bg-red-600 hover:text-white">
                    Hapus kampanye
                  </ConfirmButton>
                </form>
              </div>
            </article>
          ))}

          {!campaigns.length && canBid && (
            <p className="text-sm text-muted">Belum ada kampanye. Buat yang pertama di bawah.</p>
          )}

          {canBid && (
            <form action={createCampaign} className="card space-y-3 border-dashed p-5">
              <h3 className="font-bold">Kampanye baru</h3>
              <input type="hidden" name="cafe_id" value={cafeId} />
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <div>
                  <label htmlFor="c-name" className="label">Nama</label>
                  <input id="c-name" name="name" required maxLength={60} placeholder="Jam kerja hari biasa" className="input" />
                </div>
                <div>
                  <label htmlFor="c-budget" className="label">Budget harian</label>
                  <input id="c-budget" name="daily_budget" inputMode="numeric" required defaultValue={20000} className="input" />
                </div>
              </div>
              <SubmitButton>Buat kampanye</SubmitButton>
            </form>
          )}
        </div>
      </section>

      {/* Isi saldo */}
      <section id="isi-saldo" className="mt-8 scroll-mt-24">
        <h2 className="text-xl font-bold">Isi saldo iklan</h2>
        <div className="card mt-3 grid gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          {qris}
          <div className="space-y-3">
            <p className="text-sm text-muted">Scan QRIS, transfer nominal yang kamu mau, lalu konfirmasi di WhatsApp. Saldo masuk setelah aku cek, biasanya di hari yang sama.</p>
            <TopupBox wa={wa} cafeName={cafe.name} email={email} />
          </div>
        </div>
      </section>

      {/* Riwayat saldo */}
      <section className="mt-8">
        <h2 className="text-xl font-bold">Riwayat saldo</h2>
        {txs?.length ? (
          <ul className="card mt-3 divide-y divide-line">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{TX_LABEL[t.type] ?? t.type}</span>
                  <span className="block text-muted">{fmtDate(t.created_at)}{t.note ? ` · ${t.note}` : ""}</span>
                </span>
                <span className={`shrink-0 font-semibold ${t.amount > 0 ? "text-ok" : ""}`}>{t.amount > 0 ? "+" : ""}{rupiah(t.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Belum ada transaksi.</p>
        )}
      </section>

      <div className="mt-10 space-y-4">
        {pendingList}
        {claimForm}
      </div>
    </Shell>
  );
}

const TX_LABEL: Record<string, string> = {
  topup: "Isi saldo",
  bonus: "Bonus paket",
  click_charge: "Iklan diklik",
  impression_charge: "Iklan tampil",
  refund: "Pengembalian",
  adjustment: "Koreksi",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold tracking-tight">{value}</dd>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-8 md:py-10">{children}</div>;
}
