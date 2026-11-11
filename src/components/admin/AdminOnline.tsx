"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type OnlineUser = { id: string; name: string | null; avatar_url: string | null; username: string | null; role: string; path: string | null; started_at: string; last_seen: string };
type Online = { visitors: number; users: OnlineUser[] };

const since = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "baru saja" : m < 60 ? `${m} menit` : `${Math.floor(m / 60)} jam ${m % 60} menit`;
};

/** Kartu "Sedang online" di dashboard admin. Diperbarui tiap 30 detik selama halaman terbuka. */
export default function AdminOnline() {
  const [data, setData] = useState<Online | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const { data: d, error: e } = await supabase.rpc("admin_online");
      if (!alive) return;
      if (e) setError(true);
      else { setError(false); setData(d as Online | null); }
    };
    load();
    const id = window.setInterval(load, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => { alive = false; window.clearInterval(id); document.removeEventListener("visibilitychange", load); };
  }, []);

  const users = data?.users ?? [];
  const guests = Math.max(0, (data?.visitors ?? 0) - users.length);

  return (
    <section aria-labelledby="online" className="card mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="online" className="flex items-center gap-2 text-xl font-bold">
          <span className="relative flex h-2.5 w-2.5" aria-hidden><span className="absolute inset-0 rounded-full bg-ok" /></span>
          Sedang online
        </h2>
        <p className="text-sm text-muted">Aktif dalam 2 menit terakhir · diperbarui tiap 30 detik</p>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-muted">Status online belum aktif. Jalankan migrasi 0032 di Supabase.</p>
      ) : !data ? (
        <p className="mt-3 text-sm text-muted">Memuat…</p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            <span className="text-2xl font-extrabold tabular-nums">{data.visitors}</span>{" "}
            orang sedang membuka WFC Hunters: {users.length} akun login, {guests} pengunjung tanpa login.
          </p>
          {users.length ? (
            <ul className="mt-4 divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-tint">
                    {u.avatar_url
                      ? <Image src={u.avatar_url} alt="" fill sizes="40px" className="object-cover" unoptimized />
                      : <span className="grid h-full place-items-center text-muted"><Icon name="user" className="h-5 w-5" /></span>}
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-ok" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{u.name || "Tanpa nama"}</span>
                      {u.role === "admin" && <span className="chip !py-0 text-xs">Admin</span>}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {u.path ? <Link href={u.path} className="hover:text-brand hover:underline">{u.path}</Link> : "-"} · online {since(u.started_at)}
                    </span>
                  </span>
                  <Link href={`/admin/pengguna?q=${encodeURIComponent(u.username || u.name || "")}`} className="btn-ghost min-h-11 shrink-0 text-sm">Profil</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Belum ada akun login yang sedang online.</p>
          )}
        </>
      )}
    </section>
  );
}
