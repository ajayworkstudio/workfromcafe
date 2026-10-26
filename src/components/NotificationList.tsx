"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { reportAgo } from "@/lib/reports";
import { clearNotifications, dismissNotification } from "@/app/notifikasi/actions";

export type NotifRow = { id: string; kind: "new_cafe" | "activity"; title: string; body: string | null; url: string | null; created_at: string };

/** Daftar notifikasi dengan tombol hapus per notifikasi dan "Hapus semua". Hilang dari layar dulu, baru disimpan. */
export default function NotificationList({ rows: initial, seenAt }: { rows: NotifRow[]; seenAt: number }) {
  const [rows, setRows] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const remove = (id: string) => {
    const before = rows;
    setRows((r) => r.filter((x) => x.id !== id)); setErr(null);
    start(async () => { const res = await dismissNotification(id); if (!res.ok) { setRows(before); setErr(res.error); } });
  };
  const clearAll = () => {
    if (!confirm("Hapus semua notifikasi? Notifikasi baru nanti tetap masuk.")) return;
    const before = rows;
    setRows([]); setErr(null);
    start(async () => { const res = await clearNotifications(); if (!res.ok) { setRows(before); setErr(res.error); } });
  };

  return (
    <section className="mt-8" aria-labelledby="daftar-notif">
      <div className="flex items-center justify-between gap-3">
        <h2 id="daftar-notif" className="font-sans text-base font-bold tracking-normal">{rows.length ? `${rows.length} notifikasi` : "Notifikasi"}</h2>
        {rows.length > 0 && (
          <button type="button" onClick={clearAll} disabled={pending} className="flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted hover:bg-tint hover:text-[#8c3b25]">
            <Icon name="trash" className="h-4 w-4" />Hapus semua
          </button>
        )}
      </div>
      {err && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>}

      {!rows.length ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
          Kotak notifikasi kosong. Simpan kafe favoritmu supaya dapat kabar saat ada yang melapor kondisinya.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((n) => {
            const unread = +new Date(n.created_at) > seenAt;
            const inner = (
              <>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${n.kind === "new_cafe" ? "bg-gold/20 text-[#8a5a00]" : "bg-[#eef6f1] text-[#2f7049]"}`}>
                  <Icon name={n.kind === "new_cafe" ? "sparkle" : "users"} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">{n.title}{unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b4533a]" aria-label="Baru" />}</span>
                  {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                  <span className="mt-0.5 block text-xs text-muted">{reportAgo(n.created_at)}</span>
                </span>
              </>
            );
            return (
              <li key={n.id} className={`flex items-start ${unread ? "bg-brand-soft/40" : ""}`}>
                {n.url
                  ? <Link href={n.url} className="flex min-w-0 flex-1 gap-3 p-4 transition-colors hover:bg-tint">{inner}</Link>
                  : <div className="flex min-w-0 flex-1 gap-3 p-4">{inner}</div>}
                <button type="button" onClick={() => remove(n.id)} aria-label={`Hapus notifikasi: ${n.title}`} title="Hapus notifikasi"
                  className="m-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-tint hover:text-[#8c3b25]">
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
