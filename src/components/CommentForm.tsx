"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addComment, type CommentState } from "@/app/kafe/[slug]/comments";
import Icon from "./Icon";

export function CommentForm({
  cafeId, slug, parentId, placeholder = "Bagikan pengalamanmu kerja di sini…", autoFocus, onDone, compact,
}: { cafeId: string; slug: string; parentId?: string; placeholder?: string; autoFocus?: boolean; onDone?: () => void; compact?: boolean }) {
  const [state, action] = useActionState<CommentState, FormData>(addComment, null);
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.ok) { setText(""); onDone?.(); }
  }, [state?.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="cafe_id" value={cafeId} />
      <input type="hidden" name="slug" value={slug} />
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <textarea
        ref={ref} name="body" value={text} onChange={(e) => setText(e.target.value)}
        rows={compact ? 2 : 3} maxLength={1000} required placeholder={placeholder}
        aria-label={parentId ? "Tulis balasan" : "Tulis komentar"}
        className="input resize-y"
      />
      {state?.error && <p role="alert" className="text-sm text-[#b4533a]">{state.error}</p>}
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs tabular-nums ${text.length > 900 ? "text-[#b4533a]" : "text-muted"}`}>{text.length ? `${text.length}/1000` : ""}</span>
        <div className="flex gap-2">
          {onDone && <button type="button" onClick={onDone} className="btn-ghost !py-1.5 text-sm">Batal</button>}
          <Send label={parentId ? "Balas" : "Kirim komentar"} disabled={text.trim().length < 2} />
        </div>
      </div>
    </form>
  );
}

function Send({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className="btn-primary !py-1.5 text-sm disabled:opacity-50">
      <Icon name="send" className="h-3.5 w-3.5" />{pending ? "Mengirim…" : label}
    </button>
  );
}

export function ReplyButton({ cafeId, slug, parentId, name }: { cafeId: string; slug: string; parentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-muted hover:text-brand">Balas</button>;
  return (
    <div className="mt-2 w-full">
      <CommentForm cafeId={cafeId} slug={slug} parentId={parentId} placeholder={`Balas ${name}…`} autoFocus compact onDone={() => setOpen(false)} />
    </div>
  );
}
