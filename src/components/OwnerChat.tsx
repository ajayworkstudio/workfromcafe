import SubmitButton from "@/components/admin/SubmitButton";
import ChatAutoScroll from "./ChatAutoScroll";

export type OwnerMessage = { id: number; from_admin: boolean; body: string; created_at: string; read_at: string | null };

const when = (d: string) =>
  new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/**
 * Percakapan satu kafe antara owner dan admin. side menentukan gelembung mana yang "milikku" (kanan).
 * Form memakai server action yang diberikan pemanggil; cafe_id ikut sebagai input tersembunyi.
 */
export default function OwnerChat({ messages, side, cafeId, action, emptyText, extraHidden }: {
  messages: OwnerMessage[];
  side: "owner" | "admin";
  cafeId: string;
  action: (f: FormData) => Promise<void>;
  emptyText: string;
  extraHidden?: Record<string, string>;
}) {
  const mine = (m: OwnerMessage) => (side === "admin" ? m.from_admin : !m.from_admin);
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-line bg-surface">
      <div id="chat-log" className="max-h-[60dvh] min-h-48 space-y-3 overflow-y-auto bg-tint/50 p-4" aria-live="polite">
        {messages.length ? messages.map((m) => (
          <div key={m.id} className={`flex ${mine(m) ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${mine(m) ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-line bg-surface"}`}>
              {!mine(m) && <p className="mb-0.5 text-xs font-semibold text-brand">{m.from_admin ? "Admin WFC Hunters" : "Owner kafe"}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-right text-[11px] ${mine(m) ? "text-white/75" : "text-muted"}`}>
                {when(m.created_at)}{mine(m) && (m.read_at ? " · dibaca" : " · terkirim")}
              </p>
            </div>
          </div>
        )) : <p className="py-10 text-center text-sm text-muted">{emptyText}</p>}
      </div>
      <form action={action} className="flex items-end gap-2 border-t border-line p-3">
        <input type="hidden" name="cafe_id" value={cafeId} />
        {Object.entries(extraHidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Tulis pesan</span>
          <textarea name="body" required maxLength={2000} rows={2} placeholder="Tulis pesan…" className="input min-h-11 resize-y" />
        </label>
        <SubmitButton className="btn-primary min-h-11 shrink-0">Kirim</SubmitButton>
      </form>
      <ChatAutoScroll />
    </div>
  );
}
