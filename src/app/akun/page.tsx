import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import CafeCard from "@/components/CafeCard";
import type { Cafe } from "@/lib/types";
import { CAFE_LIST_SELECT, PLANS, rupiah } from "@/lib/utils";

export const metadata: Metadata = { title: "Akun saya" };

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ bayar?: string }> }) {
  const { bayar } = await searchParams;
  const viewer = await getViewer();
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
      {bayar === "selesai" && (
        <p className="mb-6 rounded-xl bg-leaf/10 p-4 text-sm text-leaf">
          Terima kasih! Pembayaran sedang dikonfirmasi. Status langganan akan aktif otomatis dalam beberapa saat — muat ulang halaman ini.
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Halo, {viewer.name ?? "kamu"}</h1>
          <p className="text-sm text-bean/70">{viewer.user.email}</p>
        </div>
        <form action={logout}><button className="btn-ghost">Keluar</button></form>
      </div>

      <div className="card mt-6 flex flex-wrap items-center gap-4 p-5">
        {viewer.isPremium ? (
          <>
            <div className="flex-1">
              <p className="label">Status</p>
              <p className="font-display text-xl font-bold text-terra">★ Pelanggan premium</p>
              <p className="text-sm text-bean/70">
                Aktif sampai {new Date(viewer.premiumUntil!).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <Link href="/harga" className="btn-ghost">Perpanjang</Link>
          </>
        ) : (
          <>
            <div className="flex-1">
              <p className="label">Status</p>
              <p className="font-display text-xl font-bold">Member gratis</p>
              <p className="text-sm text-bean/70">Sisa buka kafe gratis bulan ini: {(left as number) ?? 0}</p>
            </div>
            <Link href="/harga" className="btn-primary">Upgrade ke premium</Link>
          </>
        )}
      </div>

      <h2 className="mt-10 font-display text-2xl font-bold">Kafe favorit</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {favCafes.map((c) => <CafeCard key={c.id} cafe={c} />)}
      </div>
      {!favCafes.length && <p className="mt-3 text-bean/70">Belum ada. Tekan “♡ Simpan” di halaman kafe.</p>}

      {!!payments?.length && (
        <>
          <h2 className="mt-10 font-display text-2xl font-bold">Riwayat pembayaran</h2>
          <div className="card mt-4 divide-y divide-roast/10">
            {payments.map((p) => (
              <div key={p.id} className="flex justify-between gap-3 p-4 text-sm">
                <span>{PLANS[p.plan as keyof typeof PLANS]?.label} · {new Date(p.created_at).toLocaleDateString("id-ID")}</span>
                <span className="font-semibold">{rupiah(p.amount)} · {p.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
