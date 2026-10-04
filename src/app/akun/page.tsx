import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import CafeCard from "@/components/CafeCard";
import type { Cafe } from "@/lib/types";
import { CAFE_LIST_SELECT, rupiah } from "@/lib/utils";
import { PLAN_META, getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Akun saya" };

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ bayar?: string; terkonfirmasi?: string }> }) {
  const { bayar, terkonfirmasi } = await searchParams;
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!viewer.user) redirect("/masuk?next=/akun");
  const supabase = await createClient();

  const [{ data: favs }, { data: payments }, { data: left }] = await Promise.all([
    supabase.from("favorites").select(`cafe:cafes(${CAFE_LIST_SELECT})`).eq("user_id", viewer.user.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("user_id", viewer.user.id).order("created_at", { ascending: false }).limit(10),
    supabase.rpc("free_unlocks_left"),
  ]);

  const favCafes = ((favs ?? []) as unknown as { cafe: Cafe | null }[]).map((f) => f.cafe).filter(Boolean) as Cafe[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {terkonfirmasi && (
        <p className="mb-6 rounded-xl bg-ok/10 p-4 text-sm text-ok">
          Email berhasil dikonfirmasi dan kamu sudah otomatis masuk.{viewer.plan === "trial" ? " Selamat menjelajah." : ""}
        </p>
      )}
      {bayar === "selesai" && (
        <p className="mb-6 rounded-xl bg-ok/10 p-4 text-sm text-ok">
          Terima kasih! Pembayaran sedang dikonfirmasi. Status langganan akan aktif otomatis dalam beberapa saat — muat ulang halaman ini.
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Halo, {viewer.name ?? "kamu"}</h1>
          <p className="text-sm text-muted">{viewer.user.email}</p>
        </div>
        <div className="flex gap-2">
          {viewer.isAdmin && <Link href="/admin" className="btn-primary">Panel admin</Link>}
          <form action={logout}><button className="btn-ghost">Keluar</button></form>
        </div>
      </div>

      {!settings.free_mode && <div className="card mt-6 flex flex-wrap items-center gap-4 p-5">
        {viewer.isPremium ? (
          <>
            <div className="flex-1">
              <p className="label">Status</p>
              <p className="font-display text-xl font-bold text-brand">{viewer.plan === "trial" ? "Trial gratis" : "Pelanggan premium"}</p>
              <p className="text-sm text-muted">
                Aktif sampai {new Date(viewer.premiumUntil!).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                {viewer.plan === "trial" && ` (sisa ${Math.max(0, Math.ceil((new Date(viewer.premiumUntil!).getTime() - Date.now()) / 864e5))} hari)`}
              </p>
            </div>
            <Link href="/harga" className={viewer.plan === "trial" ? "btn-primary" : "btn-ghost"}>{viewer.plan === "trial" ? "Langganan sekarang" : "Perpanjang"}</Link>
          </>
        ) : (
          <>
            <div className="flex-1">
              <p className="label">Status</p>
              <p className="font-display text-xl font-bold">Member gratis</p>
              <p className="text-sm text-muted">Sisa buka kafe gratis bulan ini: {(left as number) ?? 0}</p>
            </div>
            <Link href="/harga" className="btn-primary">Upgrade ke premium</Link>
          </>
        )}
      </div>}

      <h2 className="mt-10 font-display text-2xl font-bold">Kafe favorit</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {favCafes.map((c) => <CafeCard key={c.id} cafe={c} />)}
      </div>
      {!favCafes.length && <p className="mt-3 text-muted">Belum ada. Tekan Simpan di halaman kafe untuk menyimpannya di sini.</p>}

      {!!payments?.length && (
        <>
          <h2 className="mt-10 font-display text-2xl font-bold">Riwayat pembayaran</h2>
          <div className="card mt-4 divide-y divide-ink/10">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between gap-3 p-4 text-sm">
                <span>{PLAN_META[p.plan as keyof typeof PLAN_META]?.label}, {new Date(p.created_at).toLocaleDateString("id-ID")}</span>
                <span className="flex items-center gap-2 font-semibold">
                  {rupiah(p.amount)} ({p.status === "pending" ? "menunggu" : p.status === "paid" ? "lunas" : p.status})
                  {p.method === "manual" && p.status === "pending" && <Link href={`/bayar/${p.order_id}`} className="text-brand hover:underline">Lihat instruksi</Link>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
