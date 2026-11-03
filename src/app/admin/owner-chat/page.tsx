import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Chat owner" };

type Msg = { cafe_id: string; from_admin: boolean; body: string; created_at: string; read_at: string | null };

export default async function OwnerChatInbox() {
  const supabase = await createClient();
  const [{ data, error }, { data: owners }] = await Promise.all([
    supabase.from("owner_messages").select("cafe_id,from_admin,body,created_at,read_at").order("created_at", { ascending: false }).limit(800),
    supabase.from("cafe_owners").select("cafe_id,verified_at,cafe:cafes(name)").order("created_at", { ascending: false }),
  ]);

  if (error) {
    return (
      <>
        <PageHeader title="Chat owner" />
        <p className="rounded-xl bg-tint px-4 py-3 text-sm">Chat belum aktif. Jalankan migrasi <code>0026_statistik_chat_artikel.sql</code> di Supabase.</p>
      </>
    );
  }

  const names = new Map(((owners ?? []) as unknown as { cafe_id: string; verified_at: string | null; cafe: { name: string } | null }[]).map((o) => [o.cafe_id, { name: o.cafe?.name ?? "Kafe", verified: !!o.verified_at }]));
  // Satu baris per kafe: pesan terakhir + jumlah pesan owner yang belum dibaca
  const threads = new Map<string, { last: Msg; unread: number }>();
  for (const m of (data ?? []) as Msg[]) {
    const t = threads.get(m.cafe_id) ?? { last: m, unread: 0 };
    if (!m.from_admin && !m.read_at) t.unread++;
    threads.set(m.cafe_id, t);
  }
  const silent = [...names.entries()].filter(([id]) => !threads.has(id));

  return (
    <>
      <PageHeader title="Chat owner" description="Percakapan dengan pemilik kafe. Owner juga bisa mengirim bukti kepemilikan di sini." />
      {threads.size ? (
        <ul className="card divide-y divide-line">
          {[...threads.entries()].map(([id, t]) => (
            <li key={id}>
              <Link href={`/admin/owner-chat/${id}`} className="flex items-center gap-3 p-4 hover:bg-tint/60">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">{names.get(id)?.name ?? "Kafe"}
                    {!names.get(id)?.verified && <span className="chip">klaim menunggu</span>}
                  </span>
                  <span className="block truncate text-sm text-muted">{t.last.from_admin ? "Kamu: " : ""}{t.last.body}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted">
                  {timeAgo(t.last.created_at)}
                  {!!t.unread && <span className="mt-1 block"><span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{t.unread} baru</span></span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Belum ada percakapan dengan owner.</p>}

      {!!silent.length && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">Mulai percakapan</h2>
          <p className="mt-0.5 text-sm text-muted">Owner yang sudah mengajukan klaim tapi belum pernah chat.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {silent.map(([id, o]) => (
              <li key={id}><Link href={`/admin/owner-chat/${id}`} className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand">{o.name}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
