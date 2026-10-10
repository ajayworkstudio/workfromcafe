"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { autosaveCafe } from "@/app/admin/kafe/actions";

/*
  Bar bawah form kafe + simpan otomatis.
  - Kafe yang sudah ada: perubahan dikirim ke database ±1 detik setelah berhenti mengetik.
  - Kafe baru: isian disimpan sebagai draf di perangkat ini (belum dibuat di database, supaya
    kafe setengah jadi tidak ikut tayang), dan bisa dipulihkan saat halaman dibuka lagi.
  - Kalau masih ada perubahan yang belum tersimpan, browser menanyakan dulu sebelum halaman ditutup.
*/

type Status =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date; note?: string | null }
  | { kind: "draft"; at: Date }
  | { kind: "error"; message: string };

const DRAFT_KEY = "wfc-admin-cafe-draft-baru";
const DELAY = 1200;
const time = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

type Draft = { savedAt: string; entries: [string, string][] };

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/** Isi nilai ke input, termasuk input yang dikendalikan React (koordinat), lewat setter bawaan + event. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function CafeAutosave({ cafeId, submitLabel }: { cafeId?: string; submitLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const again = useRef(false);
  const dirty = useRef(false);
  const submitting = useRef(false);

  const form = () => ref.current?.closest("form") ?? null;

  const save = useCallback(async () => {
    const f = form();
    if (!f || submitting.current) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }

    if (!cafeId) {
      // Kafe baru: draf lokal
      const entries = [...new FormData(f).entries()].filter(([, v]) => typeof v === "string") as [string, string][];
      const at = new Date();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: at.toISOString(), entries }));
        dirty.current = false;
        setStatus({ kind: "draft", at });
      } catch {
        setStatus({ kind: "error", message: "Draf tidak bisa disimpan di browser ini. Tekan Simpan kafe sebelum keluar." });
      }
      return;
    }

    if (saving.current) { again.current = true; return; }
    saving.current = true;
    dirty.current = false;
    setStatus({ kind: "saving" });
    const res = await autosaveCafe(new FormData(f)).catch(() => ({ ok: false as const, error: "Koneksi terputus. Perubahan belum tersimpan." }));
    saving.current = false;
    if (res.ok) {
      // Samakan isian rating dengan yang tersimpan (bisa berubah otomatis dari rata-rata penilaian)
      const rating = f.querySelector<HTMLInputElement>("#my_rating");
      const prev = f.querySelector<HTMLInputElement>('input[name="prev_avg"]');
      if (rating && document.activeElement !== rating) rating.value = res.myRating != null ? String(res.myRating) : "";
      if (prev) prev.value = res.myRating != null ? String(res.myRating) : "";
      setStatus(dirty.current ? { kind: "dirty" } : { kind: "saved", at: new Date(res.savedAt), note: res.note });
    } else {
      dirty.current = true;
      setStatus({ kind: "error", message: res.error });
    }
    if (again.current) { again.current = false; save(); }
  }, [cafeId]);

  const schedule = useCallback(() => {
    if (submitting.current) return;
    dirty.current = true;
    setStatus((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, cafeId ? DELAY : 400);
  }, [save, cafeId]);

  useEffect(() => {
    const f = form();
    if (!f) return;
    // Tombol jenis "button" (mis. jam buka) mengubah isian lewat state React, jadi dengarkan kliknya juga
    const onClick = (e: Event) => { if ((e.target as HTMLElement).closest('button[type="button"]')) schedule(); };
    const onSubmit = () => {
      submitting.current = true;
      if (timer.current) clearTimeout(timer.current);
      if (!cafeId) { try { localStorage.removeItem(DRAFT_KEY); } catch { /* abaikan */ } }
    };
    f.addEventListener("input", schedule);
    f.addEventListener("change", schedule);
    f.addEventListener("click", onClick);
    f.addEventListener("submit", onSubmit);

    // Sebelum pindah halaman lewat link: kirim perubahan yang masih menunggu
    const onLink = (e: MouseEvent) => {
      if (dirty.current && (e.target as HTMLElement).closest("a[href]")) save();
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (submitting.current) return;
      if (!cafeId && dirty.current) save(); // draf lokal tersimpan seketika
      if (dirty.current || saving.current) { e.preventDefault(); e.returnValue = ""; }
    };
    document.addEventListener("click", onLink, true);
    window.addEventListener("beforeunload", onLeave);

    if (!cafeId) {
      const d = readDraft();
      if (d?.entries.some(([k, v]) => k !== "price_range" && !k.startsWith("hours_") && v && v !== "on")) setDraft(d);
    }

    return () => {
      f.removeEventListener("input", schedule);
      f.removeEventListener("change", schedule);
      f.removeEventListener("click", onClick);
      f.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", onLink, true);
      window.removeEventListener("beforeunload", onLeave);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule, save, cafeId]);

  const restore = () => {
    const f = form();
    if (!f || !draft) return;
    const values = new Map<string, string[]>();
    for (const [k, v] of draft.entries) values.set(k, [...(values.get(k) ?? []), v]);
    for (const el of Array.from(f.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[]) {
      if (!el.name || el.type === "hidden" || el.type === "submit") continue;
      const vals = values.get(el.name);
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        el.checked = !!vals?.includes(el.value);
      } else if (vals) {
        setNativeValue(el, vals[0]);
      }
    }
    // Jam buka disimpan di komponen sendiri; kirim nilainya lewat event
    window.dispatchEvent(new CustomEvent("cafe-draft-hours", { detail: Object.fromEntries(draft.entries.filter(([k]) => k.startsWith("hours_"))) }));
    setDraft(null);
    setStatus({ kind: "draft", at: new Date(draft.savedAt) });
  };

  const discard = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* abaikan */ }
    setDraft(null);
  };

  const label = (() => {
    switch (status.kind) {
      case "idle": return cafeId ? "Perubahan tersimpan otomatis" : "Isian disimpan otomatis sebagai draf di perangkat ini";
      case "dirty": return cafeId ? "Ada perubahan, menyimpan sebentar lagi…" : "Menyimpan draf…";
      case "saving": return "Menyimpan…";
      case "saved": return `Tersimpan otomatis pukul ${time(status.at)}${status.note ? `. ${status.note}` : ""}`;
      case "draft": return `Draf tersimpan di perangkat ini pukul ${time(status.at)}. Tekan Simpan kafe untuk membuatnya.`;
      case "error": return status.message;
    }
  })();
  const tone = status.kind === "error" ? "text-[#8c3b25]" : status.kind === "saved" ? "text-[#2f7049]" : "text-muted"; // hijau lebih gelap dari --ok supaya kontras teks kecil lolos AA

  return (
    <div ref={ref} className="sticky bottom-20 z-10 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
      {draft && (
        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm">
          <span>Ada draf kafe baru yang belum disimpan dari {new Date(draft.savedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}.</span>
          <span className="flex gap-2">
            <button type="button" onClick={discard} className="btn-ghost !py-1.5 text-sm">Buang</button>
            <button type="button" onClick={restore} className="btn-primary !py-1.5 text-sm">Pulihkan draf</button>
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className={`flex min-w-0 items-center gap-2 text-sm ${tone}`}>
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${status.kind === "error" ? "bg-[#b4533a]" : status.kind === "saved" || status.kind === "draft" || status.kind === "idle" ? "bg-ok" : "bg-gold"}`} />
          {label}
          {status.kind === "error" && cafeId && (
            <button type="button" onClick={() => save()} className="font-semibold text-brand underline">Coba lagi</button>
          )}
        </p>
        <Submit>{submitLabel}</Submit>
      </div>
    </div>
  );
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="btn-primary min-h-11">{pending ? "Menyimpan…" : children}</button>;
}
