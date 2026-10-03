import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Subscribers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id,plan,status,start_date,end_date,amount,user_id")
    .order("end_date", { ascending: false })
    .limit(200);
  const ids = [...new Set((data ?? []).map((s) => s.user_id))];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id,name,email").in("id", ids)
    : { data: [] as { id: string; name: string; email: string }[] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const now = new Date();

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-bean/60">
          <tr><th className="p-3">Nama</th><th className="p-3">Email</th><th className="p-3">Paket</th><th className="p-3">Berlaku sampai</th><th className="p-3">Status</th></tr>
        </thead>
        <tbody className="divide-y divide-roast/10">
          {(data ?? []).map((s) => {
            const p = byId.get(s.user_id);
            const active = s.status === "active" && new Date(s.end_date) > now;
            return (
              <tr key={s.id}>
                <td className="p-3">{p?.name ?? "-"}</td>
                <td className="p-3">{p?.email ?? "-"}</td>
                <td className="p-3">{s.plan === "yearly" ? "Tahunan" : "Bulanan"}</td>
                <td className="p-3">{new Date(s.end_date).toLocaleDateString("id-ID")}</td>
                <td className="p-3"><span className={`chip ${active ? "!text-leaf" : ""}`}>{active ? "aktif" : "berakhir"}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!data?.length && <p className="p-4 text-bean/60">Belum ada pelanggan.</p>}
    </div>
  );
}
