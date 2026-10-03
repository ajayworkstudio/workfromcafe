import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = await createClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [cafes, users, subs, paidMonth, paidAll, recent] = await Promise.all([
    supabase.from("cafes").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("user_id").eq("status", "active").gt("end_date", new Date().toISOString()),
    supabase.from("payments").select("amount").eq("status", "paid").gte("created_at", monthStart),
    supabase.from("payments").select("amount").eq("status", "paid"),
    supabase.from("payments").select("order_id,plan,amount,status,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const sum = (rows: { amount: number }[] | null) => (rows ?? []).reduce((a, r) => a + r.amount, 0);
  const activeSubs = new Set((subs.data ?? []).map((s) => s.user_id)).size;

  const stats = [
    { label: "Kafe", value: String(cafes.count ?? 0) },
    { label: "Pengguna terdaftar", value: String(users.count ?? 0) },
    { label: "Pelanggan aktif", value: String(activeSubs) },
    { label: "Pendapatan bulan ini", value: rupiah(sum(paidMonth.data)) },
    { label: "Total pendapatan", value: rupiah(sum(paidAll.data)) },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="label">{s.label}</p>
            <p className="font-display text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-8 font-display text-xl font-bold">Transaksi terbaru</h2>
      <div className="card mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-bean/60">
            <tr><th className="p-3">Order</th><th className="p-3">Paket</th><th className="p-3">Nominal</th><th className="p-3">Status</th><th className="p-3">Tanggal</th></tr>
          </thead>
          <tbody className="divide-y divide-roast/10">
            {(recent.data ?? []).map((p) => (
              <tr key={p.order_id}>
                <td className="p-3 font-mono text-xs">{p.order_id}</td>
                <td className="p-3">{p.plan}</td>
                <td className="p-3">{rupiah(p.amount)}</td>
                <td className="p-3"><span className={`chip ${p.status === "paid" ? "!text-leaf" : ""}`}>{p.status}</span></td>
                <td className="p-3">{new Date(p.created_at).toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!recent.data?.length && <p className="p-4 text-bean/60">Belum ada transaksi.</p>}
      </div>
    </>
  );
}
