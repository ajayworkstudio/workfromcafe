import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteComment } from "@/app/kafe/[slug]/comments";
import { timeAgo } from "@/lib/utils";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { CommentForm, ReplyButton } from "./CommentForm";

type Row = {
  id: string; parent_id: string | null; body: string; created_at: string;
  user_id: string; author_name: string; author_avatar: string | null; author_is_admin: boolean;
};

export default async function CafeComments({
  cafeId, slug, viewerId, viewerIsAdmin, contributorId,
}: { cafeId: string; slug: string; viewerId: string | null; viewerIsAdmin: boolean; contributorId?: string | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cafe_comments_list", { p_cafe_id: cafeId });
  if (error) return null; // migrasi 0011 belum dijalankan
  const rows = (data as Row[] | null) ?? [];
  const top = rows.filter((r) => !r.parent_id);
  const replies = (id: string) => rows.filter((r) => r.parent_id === id);

  const Badge = ({ r }: { r: Row }) =>
    r.author_is_admin ? <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">Admin</span>
      : contributorId && r.user_id === contributorId ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">Author</span>
      : null;

  const Item = ({ r, small }: { r: Row; small?: boolean }) => (
    <div className="flex gap-3">
      <Avatar url={r.author_avatar} name={r.author_name} className={small ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-semibold">{r.author_name}</span>
          <Badge r={r} />
          <time dateTime={r.created_at} className="text-xs text-muted">{timeAgo(r.created_at)}</time>
        </p>
        <p className="mt-1 whitespace-pre-line break-words leading-relaxed text-ink/90">{r.body}</p>
        {(r.user_id === viewerId || viewerIsAdmin) && (
          <form action={deleteComment} className="mt-1 inline-block">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="slug" value={slug} />
            <button className="text-xs font-medium text-muted hover:text-[#b4533a]">Hapus</button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <section id="komentar" className="mt-12 scroll-mt-24">
      <h2 className="flex items-baseline gap-2 text-2xl font-bold">
        Komentar <span className="text-base font-medium text-muted">{rows.length || ""}</span>
      </h2>
      <p className="mt-1 text-sm text-muted">Pernah kerja di sini? Bagikan kondisi terbaru: wifi, keramaian, menu baru, atau tips tempat duduk.</p>

      <div className="mt-5">
        {viewerId ? (
          <CommentForm cafeId={cafeId} slug={slug} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line p-5">
            <p className="text-sm text-muted">Masuk untuk ikut berkomentar. Gratis.</p>
            <Link href={`/masuk?next=${encodeURIComponent(`/kafe/${slug}#komentar`)}`} className="btn-dark !py-2 text-sm">Masuk untuk berkomentar</Link>
          </div>
        )}
      </div>

      {top.length ? (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {top.map((r) => (
            <li key={r.id} className="py-5">
              <Item r={r} />
              <div className="ml-[52px]">
                {replies(r.id).length > 0 && (
                  <ul className="mt-4 space-y-4 border-l-2 border-line pl-4">
                    {replies(r.id).map((x) => <li key={x.id}><Item r={x} small /></li>)}
                  </ul>
                )}
                {viewerId && <div className="mt-2"><ReplyButton cafeId={cafeId} slug={slug} parentId={r.id} name={r.author_name} /></div>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted"><Icon name="smile" className="h-4 w-4" />Belum ada komentar. Jadi yang pertama!</p>
      )}
    </section>
  );
}
