import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { rupiah } from "@/lib/utils";
import { parseRupiah, todayWib, type CafePlan } from "@/lib/ads";

export const metadata: Metadata = { title: "Iklan kafe" };

const back = (msg: string, err = false): never => redirect(`/admin/iklan?${err ? "err" : "ok"}=${encodeURIComponent(msg)}`);

async function verifyClaim(f: FormData) {
  "use server";
  await requireAdmin();
  const { error } = await (await createClient()).from("cafe_owners").update({ verified_at: new Date().toISOString() }).eq("id", String(f.get("id")));
  revalidatePath("/admin/iklan");
  back(error ? `Gagal: ${error.message}` : "Klaim diverifikasi. Owner sekarang bisa memilih paket.", !!error);
}

async function rejectClaim(f: FormData) {
  "use server";
  await requireAdmin();
  const { error } = await (await createClient()).from("cafe_owners").delete().eq("id", String(f.get("id")));
  revalidatePath("/admin/iklan");
  back(error ? `Gagal: ${error.message}` : "Klaim ditolak dan dihapus.", !!error);
}

async function activatePlan(f: FormData) {
  "use server";
  const admin = await requireAdmin();
  const supabase = await createClient();
  const id = String(f.get("id"));
  const months = Math.min(12, Math.max(1, Number(f.get("months")) || 1));
  const { data: sub } = await supabase.from("cafe_subscriptions").select("cafe_id,plan_id,cafe_plans(name,bonus_ad_credit)").eq("id", id).maybeSingle();
  if (!sub) back("Pengajuan paket tidak ditemukan.", true);

  const start = todayWib();
  const end = new Date(`${start}T00:00:00+07:00`);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  const { error } = await supabase.from("cafe_subscriptions").update({
    status: "active", starts_at: start, ends_at: end.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }),
    confirmed_by: admin.user!.id, payment_ref: String(f.get("payment_ref") ?? "").trim() || null,
  }).eq("id", id);
  if (error) back(`Gagal mengaktifkan: ${error.message}`, true);

  const p = sub!.cafe_plans as unknown as { name: string; bonus_ad_credit: number } | null;
  if (p?.bonus_ad_credit) {
    await supabase.rpc("admin_wallet_adjust", {
      p_cafe_id: sub!.cafe_id, p_amount: p.bonus_ad_credit * months, p_type: "bonus", p_note: `Bonus paket ${p.name}`,
    });
  }
  revalidatePath("/admin/iklan");
  back(`Paket ${p?.name ?? ""} aktif ${months} bulan.${p?.bonus_ad_credit ? ` Bonus ${rupiah(p.bonus_ad_credit * months)} masuk ke saldo.` : ""}`);
}

async function cancelPlan(f: FormData) {
  "use server";
  await requireAdmin();
  const { error } = await (await createClient()).from("cafe_subscriptions").update({ status: "cancelled" }).eq("id", String(f.get("id")));
  revalidatePath("/admin/iklan");
  back(error ? `Gagal: ${error.message}` : "Pengajuan paket dibatalkan.", !!error);
}

async function adjustWallet(f: FormData) {
  "use server";
  await requireAdmin();
  const amount = parseRupiah(f.get("amount")) * (f.get("sign") === "-" ? -1 : 1);
  if (!amount) back("Isi nominal.", true);
  const { data, error } = await (await createClient()).rpc("admin_wallet_adjust", {
    p_cafe_id: String(f.get("cafe_id")), p_amount: amount,
    p_type: amount > 0 ? "topup" : "adjustment", p_note: String(f.get("note") ?? "").trim().slice(0, 120) || null,
  });
  revalidatePath("/admin/iklan");
  back(error ? `Gagal: ${/balance/.test(error.message) ? "saldo tidak boleh minus." : error.message}` : `Saldo sekarang ${rupiah(data as number)}.`, !!error);
}

async function setQuality(f: FormData) {
  "use server";
  await requireAdmin();
  const clamp = (v: FormDataEntryValue | null) => Math.min(1, Math.max(0, Number(String(v ?? "").replace(",", ".")) || 0));
  const { error } = await (await createClient()).from("cafe_quality_scores").upsert({
    cafe_id: String(f.get("cafe_id")), rating_score: clamp(f.get("rating")), curator_score: clamp(f.get("curator")),
    ctr_score: clamp(f.get("ctr")), updated_at: new Date().toISOString(),
  });
  revalidatePath("/admin/iklan");
  back(error ? `Gagal: ${error.message}` : "Skor kualitas disimpan.", !!error);
}

type OwnerRow = { id: string; cafe_id: string; user_id: string; verified_at: string | null; created_at: string; cafe: { name: string; slug: string } | null };
type SubRow = { id: string; cafe_id: string; plan_id: number; status: string; ends_at: string | null; created_at: string; cafe: { name: string } | null };

export default async function AdsAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: ownersRaw, error }, { data: subsRaw }, { data: plansRaw }, { data: wallets }, { data: scores }] = await Promise.all([
    supabase.from("cafe_owners").select("id,cafe_id,user_id,verified_at,created_at,cafe:cafes(name,slug)").order("created_at", { ascending: false }),
    supabase.from("cafe_subscriptions").select("id,cafe_id,plan_id,status,ends_at,created_at,cafe:cafes(name)").in("status", ["pending", "active"]).order("created_at", { ascending: false }),
    supabase.from("cafe_plans").select("*").order("id"),
    supabase.from("ad_wallets").select("cafe_id,balance"),
    supabase.from("cafe_quality_scores").select("cafe_id,rating_score,curator_score,ctr_score,quality_score"),
  ]);

  if (error) {
    return (
      <>
        <PageHeader title="Iklan kafe" />
        <p className="rounded-xl bg-tint px-4 py-3 text-sm">Fitur iklan belum aktif. Jalankan migrasi <code>0025_iklan_kafe.sql</code> di Supabase.</p>
      </>
    );
  }

  const owners = (ownersRaw ?? []) as unknown as OwnerRow[];
  const subs = (subsRaw ?? []) as unknown as SubRow[];
  const plans = (plansRaw ?? []) as CafePlan[];
  const ids = [...new Set(owners.map((o) => o.user_id))];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id,name,email").in("id", ids)
    : { data: [] as { id: string; name: string | null; email: string | null }[] };
  const who = (uid: string) => {
    const p = profiles?.find((x) => x.id === uid);
    return [p?.name, p?.email].filter(Boolean).join(" · ") || uid.slice(0, 8);
  };

  const pendingClaims = owners.filter((o) => !o.verified_at);
  const verified = owners.filter((o) => o.verified_at);
  const verifiedCafes = [...new Map(verified.map((o) => [o.cafe_id, o.cafe?.name ?? o.cafe_id])).entries()];
  const pendingSubs = subs.filter((s) => s.status === "pending");
  const today = todayWib();
  const activeSubs = subs.filter((s) => s.status === "active" && s.ends_at && s.ends_at >= today);
  const planName = (id: number) => plans.find((p) => p.id === id)?.name ?? `Paket ${id}`;
  const planPrice = (id: number) => plans.find((p) => p.id === id)?.monthly_price ?? 0;

  return (
    <>
      <PageHeader title="Iklan kafe" description="Verifikasi owner, aktifkan paket setelah pembayaran QRIS masuk, dan isi saldo iklan." />
      <Flash ok={sp.ok} err={sp.err} />

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-bold">Klaim menunggu verifikasi</h2>
          {pendingClaims.length ? (
            <ul className="card mt-3 divide-y divide-line">
              {pendingClaims.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{o.cafe?.name}</p>
                    <p className="break-words text-sm text-muted">{who(o.user_id)} · {new Date(o.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
                  </div>
                  <form action={verifyClaim}><input type="hidden" name="id" value={o.id} /><SubmitButton className="btn-primary !py-2 text-sm">Verifikasi</SubmitButton></form>
                  <form action={rejectClaim}><input type="hidden" name="id" value={o.id} />
                    <ConfirmButton message={`Tolak klaim ${o.cafe?.name}?`} className="btn-ghost !py-2 text-sm">Tolak</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">Tidak ada klaim baru.</p>}
        </section>

        <section>
          <h2 className="text-lg font-bold">Paket menunggu pembayaran</h2>
          {pendingSubs.length ? (
            <ul className="card mt-3 divide-y divide-line">
              {pendingSubs.map((s) => (
                <li key={s.id} className="space-y-3 p-4">
                  <p><b>{s.cafe?.name}</b> · {planName(s.plan_id)} · {rupiah(planPrice(s.plan_id))}/bulan</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <form action={activatePlan} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <div><label htmlFor={`m-${s.id}`} className="label">Bulan</label>
                        <input id={`m-${s.id}`} name="months" type="number" min={1} max={12} defaultValue={1} className="input !w-20" /></div>
                      <div><label htmlFor={`r-${s.id}`} className="label">Ref. pembayaran</label>
                        <input id={`r-${s.id}`} name="payment_ref" placeholder="opsional" className="input !w-40" /></div>
                      <SubmitButton className="btn-primary">Aktifkan</SubmitButton>
                    </form>
                    <form action={cancelPlan}><input type="hidden" name="id" value={s.id} />
                      <ConfirmButton message="Batalkan pengajuan paket ini?" className="btn-ghost">Batalkan</ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">Tidak ada pengajuan paket.</p>}
        </section>

        <section>
          <h2 className="text-lg font-bold">Kafe dengan owner terverifikasi</h2>
          {verifiedCafes.length ? (
            <div className="mt-3 space-y-3">
              {verifiedCafes.map(([cafeId, name]) => {
                const sub = activeSubs.find((s) => s.cafe_id === cafeId);
                const q = scores?.find((x) => x.cafe_id === cafeId);
                const bal = wallets?.find((w) => w.cafe_id === cafeId)?.balance ?? 0;
                return (
                  <article key={cafeId} className="card space-y-4 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="flex-1 font-semibold">{name}</p>
                      <span className="chip">{sub ? `${planName(sub.plan_id)} s.d. ${new Date(sub.ends_at!).toLocaleDateString("id-ID")}` : "Tanpa paket"}</span>
                      <span className="chip">Saldo {rupiah(bal)}</span>
                    </div>
                    <form action={adjustWallet} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="cafe_id" value={cafeId} />
                      <div><label htmlFor={`s-${cafeId}`} className="label">Jenis</label>
                        <select id={`s-${cafeId}`} name="sign" className="input !w-32"><option value="+">Isi saldo</option><option value="-">Kurangi</option></select></div>
                      <div><label htmlFor={`a-${cafeId}`} className="label">Nominal</label>
                        <input id={`a-${cafeId}`} name="amount" inputMode="numeric" required placeholder="50000" className="input !w-32" /></div>
                      <div className="min-w-[10rem] flex-1"><label htmlFor={`n-${cafeId}`} className="label">Catatan</label>
                        <input id={`n-${cafeId}`} name="note" placeholder="QRIS 31 Okt" className="input" /></div>
                      <SubmitButton className="btn-primary">Simpan saldo</SubmitButton>
                    </form>
                    <form action={setQuality} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="cafe_id" value={cafeId} />
                      {([["rating", "Rating", q?.rating_score], ["curator", "Kurator", q?.curator_score], ["ctr", "Klik", q?.ctr_score]] as const).map(([k, l, v]) => (
                        <div key={k}><label htmlFor={`${k}-${cafeId}`} className="label">{l} (0 sampai 1)</label>
                          <input id={`${k}-${cafeId}`} name={k} inputMode="decimal" defaultValue={v ?? 0.5} className="input !w-28" /></div>
                      ))}
                      <SubmitButton className="btn-ghost">Simpan skor</SubmitButton>
                      {q && <p className="w-full text-xs text-muted">Skor kualitas sekarang {Number(q.quality_score).toLocaleString("id-ID")}</p>}
                    </form>
                  </article>
                );
              })}
            </div>
          ) : <p className="mt-2 text-sm text-muted">Belum ada owner terverifikasi.</p>}
        </section>
      </div>
    </>
  );
}
