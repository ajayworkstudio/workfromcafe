import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import SubmitButton from "@/components/admin/SubmitButton";
import ConfirmButton from "@/components/admin/ConfirmButton";
import Icon from "@/components/Icon";
import { rupiah } from "@/lib/utils";

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
  const { data } = await query;
  const subs = (data ?? []) as Sub[];

  const ids = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,name,email").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p as { id: string; name: string | null; email: string | null }]));
  const q = sp.q?.toLowerCase();
  const rows = subs.filter((s) => !q || [byId.get(s.user_id)?.name, byId.get(s.user_id)?.email].some((x) => x?.toLowerCase().includes(q)));
  const now = new Date();

  return (
    <>
      <PageHeader title="Pelanggan" description="Langganan dari pembayaran Midtrans dan akses yang kamu berikan manual." />
      <Flash ok={sp.ok} err={sp.err} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <form className="mb-4 flex flex-wrap gap-2">
            <input name="q" defaultValue={sp.q} placeholder="Cari nama atau email" aria-label="Cari pelanggan" className="input min-w-[180px] flex-1" />
            <select name="tampil" defaultValue={sp.tampil ?? "aktif"} aria-label="Tampilkan" className="input !w-auto">
              <option value="aktif">Yang aktif</option>
              <option value="semua">Semua riwayat</option>
            </select>
            <button className="btn-dark">Terapkan</button>
          </form>

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
                    <p>{s.plan === "yearly" ? "Tahunan" : "Bulanan"} · {s.midtrans_order_id ? rupiah(s.amount) : "Manual"}</p>
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
