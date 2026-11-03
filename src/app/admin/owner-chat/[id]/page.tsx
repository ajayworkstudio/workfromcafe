import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/admin/PageHeader";
import Flash from "@/components/admin/Flash";
import OwnerChat, { type OwnerMessage } from "@/components/OwnerChat";
import { createClient } from "@/lib/supabase/server";
import { sendAdminReply } from "../actions";

export const metadata: Metadata = { title: "Chat owner" };

export default async function OwnerChatThread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: cafe }, { data: msgs }, { data: owners }] = await Promise.all([
    supabase.from("cafes").select("id,name,slug").eq("id", id).maybeSingle(),
    supabase.from("owner_messages").select("id,from_admin,body,created_at,read_at").eq("cafe_id", id).order("created_at").limit(300),
    supabase.from("cafe_owners").select("user_id,verified_at").eq("cafe_id", id),
  ]);
  if (!cafe) notFound();
  await supabase.rpc("owner_messages_mark_read", { p_cafe_id: id });

  const ids = (owners ?? []).map((o) => o.user_id as string);
  const { data: people } = ids.length ? await supabase.from("profiles").select("id,name,email").in("id", ids) : { data: [] };

  return (
    <>
      <Link href="/admin/owner-chat" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">← Semua percakapan</Link>
      <PageHeader title={cafe.name}
        description={(people ?? []).map((p) => [p.name, p.email].filter(Boolean).join(" · ")).join(", ") || "Belum ada owner yang mengajukan klaim."}
        action={<div className="flex flex-wrap gap-2">
          <Link href={`/admin/statistik/${id}`} className="btn-ghost min-h-11">Statistik</Link>
          <Link href="/admin/iklan" className="btn-ghost min-h-11">Klaim & paket</Link>
        </div>} />
      <Flash err={sp.err} />
      {ids.length ? (
        <OwnerChat messages={(msgs ?? []) as OwnerMessage[]} side="admin" cafeId={id} action={sendAdminReply}
          emptyText="Belum ada pesan. Sapa owner-nya, misalnya untuk minta bukti kepemilikan atau menawarkan paket." />
      ) : (
        <p className="rounded-2xl bg-tint p-5 text-sm">Chat terbuka setelah owner mengajukan klaim lewat halaman <b>/pemilik</b>. Untuk menawarkan kerja sama sebelum itu, kirim <Link href={`/laporan/${id}`} className="font-semibold text-brand underline">laporan kafe</Link> lewat WhatsApp atau DM Instagram.</p>
      )}
    </>
  );
}
