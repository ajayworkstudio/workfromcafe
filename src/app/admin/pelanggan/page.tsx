import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmButton from "@/components/admin/ConfirmButton";
import Icon from "@/components/Icon";
import AutoFilterForm from "@/components/AutoFilterForm";
import { rupiah } from "@/lib/utils";
import { activateFromPayment } from "@/lib/subscription";
import { planLabel } from "@/lib/settings";

/** Beri akses premium manual (hadiah, kerja sama, uji coba). Ditulis lewat service role karena tabel langganan read-only untuk pengguna. */
async function grantPremium(formData: FormData) {
  "use server";
  await requireAdmin();
  const email = String(formData.get("email")).trim().toLowerCase();
  const months = Number(formData.get("months"));
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id,name").ilike("email", email).maybeSingle();
  if (!profile) redirect(`/admin/pelanggan?err=${encodeURIComponent(`Belum ada akun dengan email ${email}. Minta dia daftar dulu.`)}`);

  const { data: current } = await admin.from("subscriptions").select("end_date")
    .eq("user_id", profile!.id).eq("status", "active").gt("end_date", new Date().toISOString())
    .order("end_date", { ascending: false }).limit(1).maybeSingle();
  const start = current ? new Date(current.end_date) : new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);

  const { error } = await admin.from("subscriptions").insert({
    user_id: profile!.id, plan: months >= 12 ? "yearly" : "monthly", status: "active",
    start_date: start.toISOString(), end_date: end.toISOString(), amount: 0,
  });
  revalidatePath("/admin/pelanggan");
  redirect(error ? `/admin/pelanggan?err=${encodeURIComponent(error.message)}`
    : `/admin/pelanggan?ok=${encodeURIComponent(`${profile!.name ?? email} premium sampai ${end.toLocaleDateString("id-ID", { dateStyle: "long" })}.`)}`);
}

async function approveManual(formData: FormData) {
  "use server";
  await requireAdmin();
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("id,user_id,plan,amount,order_id,status")
    .eq("id", String(formData.get("id"))).eq("method", "manual").maybeSingle();
  if (!payment || payment.status !== "pending") redirect(`/admin/pelanggan?err=${encodeURIComponent("Tagihan sudah diproses sebelumnya.")}`);
  const end = await activateFromPayment(admin, payment!);
  revalidatePath("/admin", "layout");
  redirect(`/admin/pelanggan?ok=${encodeURIComponent(`Pembayaran ${payment!.order_id} disetujui. Premium aktif sampai ${end.toLocaleDateString("id-ID", { dateStyle: "long" })}.`)}`);
}

async function rejectManual(formData: FormData) {
  "use server";
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("payments").update({ status: "failed" }).eq("id", String(formData.get("id"))).eq("method", "manual").eq("status", "pending");
  revalidatePath("/admin", "layout");
  redirect(`/admin/pelanggan?ok=${encodeURIComponent("Tagihan ditolak.")}`);
}

async function stopSubscription(formData: FormData) {
  "use server";
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("subscriptions").update({ status: "cancelled" }).eq("id", String(formData.get("id")));
  revalidatePath("/admin/pelanggan");
  redirect(`/admin/pelanggan?ok=${encodeURIComponent("Akses premium dihentikan.")}`);
}

type Sub = { id: string; plan: string; status: string; start_date: string; end_date: string; amount: number; user_id: string; midtrans_order_id: string | null };

export default async function Subscribers({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; tampil?: string; q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  let query = supabase.from("subscriptions").select("id,plan,status,start_date,end_date,amount,user_id,midtrans_order_id").order("end_date", { ascending: false }).limit(300);
  if (sp.tampil !== "semua") query = query.eq("status", "active").gt("end_date", nowIso);
  const [{ data }, { data: pendingData }] = await Promise.all([
    query,
    supabase.from("payments").select("id,order_id,plan,amount,created_at,user_id").eq("method", "manual").eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  const subs = (data ?? []) as Sub[];
  const pending = (pendingData ?? []) as { id: string; order_id: string; plan: string; amount: number; created_at: string; user_id: string }[];

  const ids = [...new Set([...subs.map((s) => s.user_id), ...pending.map((p) => p.user_id)])];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,name,email").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p as { id: string; name: string | null; email: string | null }]));
  const q = sp.q?.toLowerCase();
  const rows = subs.filter((s) => !q || [byId.get(s.user_id)?.name, byId.get(s.user_id)?.email].some((x) => x?.toLowerCase().includes(q)));
  const now = new Date();

  return (
    <>
      <PageHeader title="Pelanggan" description="Konfirmasi pembayaran QRIS dan kelola akses premium." />
      <Flash ok={sp.ok} err={sp.err} />

      {!!pending.length && (
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-bold">Menunggu konfirmasi ({pending.length})</h2>
          <p className="mb-3 text-sm text-muted">Pembayaran manual lewat QRIS. Cocokkan nominal (termasuk 3 digit kode unik) dengan mutasi sebelum menyetujui.</p>
          <div className="card divide-y divide-line border-gold/50">
            {pending.map((p) => {
              const u = byId.get(p.user_id);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 pl-4">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold">{u?.name ?? "Tanpa nama"} <span className="font-normal text-muted">{u?.email}</span></p>
                    <p className="text-sm text-muted">{p.order_id} · {p.plan === "yearly" ? "Tahunan" : "Bulanan"} · {new Date(p.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <p className="font-display text-xl font-bold tabular-nums">{rupiah(p.amount)}</p>
                  <div className="flex gap-1">
                    <form action={rejectManual}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton message={`Tolak tagihan ${p.order_id}?`} className="btn-ghost !px-3 !py-1.5 text-sm text-red-700">Tolak</ConfirmButton>
                    </form>
                    <form action={approveManual}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton message={`Sudah cek mutasi ${rupiah(p.amount)} masuk? Premium ${u?.name ?? u?.email} akan langsung aktif.`}
                        className="btn-primary !px-4 !py-1.5 text-sm" pendingText="Mengaktifkan…">Setujui</ConfirmButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <AutoFilterForm className="mb-4 flex flex-wrap gap-2">
            <input type="search" name="q" defaultValue={sp.q} placeholder="Cari nama atau email" aria-label="Cari pelanggan" className="input min-w-[180px] flex-1" />
            <select name="tampil" defaultValue={sp.tampil ?? "aktif"} aria-label="Tampilkan" className="input !w-auto">
              <option value="aktif">Yang aktif</option>
              <option value="semua">Semua riwayat</option>
            </select>
          </AutoFilterForm>

          <div className="card divide-y divide-line">
            {rows.map((s) => {
              const p = byId.get(s.user_id);
              const active = s.status === "active" && new Date(s.end_date) > now;
              const daysLeft = Math.ceil((new Date(s.end_date).getTime() - now.getTime()) / 864e5);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 p-3 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p?.name ?? "Tanpa nama"}</p>
                    <p className="truncate text-sm text-muted">{p?.email}</p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p>{planLabel(s.plan)}{s.plan !== "trial" && <> · {s.midtrans_order_id ? rupiah(s.amount) : "Manual"}</>}</p>
                    <p className={active && daysLeft <= 7 ? "font-medium text-[#9a5b00]" : "text-muted"}>
                      {active ? `Sampai ${new Date(s.end_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}${daysLeft <= 7 ? ` (${daysLeft} hari lagi)` : ""}`
                        : s.status === "cancelled" ? "Dihentikan" : "Berakhir"}
                    </p>
                  </div>
                  {active && (
                    <form action={stopSubscription}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmButton message={`Hentikan akses premium ${p?.name ?? p?.email}? Pembayaran tidak otomatis dikembalikan.`}
                        className="btn-ghost !px-3 !py-1.5 text-sm text-red-700">Hentikan</ConfirmButton>
                    </form>
                  )}
                </div>
              );
            })}
            {!rows.length && <p className="p-6 text-center text-muted">{sp.tampil === "semua" ? "Belum ada riwayat langganan." : "Belum ada pelanggan aktif."}</p>}
          </div>
        </div>

        <form action={grantPremium} className="card h-fit space-y-3 p-5 lg:sticky lg:top-24">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="star" filled className="h-5 w-5 text-gold" />Beri akses premium</h2>
          <p className="text-sm text-muted">Untuk hadiah, kerja sama, atau uji coba. Kalau masih aktif, masa berlakunya ditambahkan.</p>
          <div><label htmlFor="g-email" className="label">Email akun</label><input id="g-email" name="email" type="email" required className="input" /></div>
          <div>
            <label htmlFor="g-months" className="label">Lama</label>
            <select id="g-months" name="months" defaultValue="1" className="input">
              <option value="1">1 bulan</option><option value="3">3 bulan</option><option value="6">6 bulan</option><option value="12">1 tahun</option>
            </select>
          </div>
          <SubmitButton className="btn-primary w-full">Beri akses</SubmitButton>
        </form>
      </div>
    </>
  );
}
