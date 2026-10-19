"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Icon from "./Icon";

/**
 * Tombol "Filter" + lembar berisi filter lengkap. Lembar tetap berada di dalam <form> filter,
 * jadi setiap pilihan langsung diterapkan (AutoFilterForm) dan hasil di belakangnya ikut berubah.
 * HP: lembar dari bawah. Layar lebar: panel di tengah.
 */
export default function FilterSheet({ count, total, resetHref, children }: { count: number; total: number; resetHref: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };

  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-label={count ? `Filter, ${count} aktif` : "Filter"}
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-ink">
        <Icon name="sliders" className="h-5 w-5" />
        {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-foam px-1 text-[11px] font-extrabold text-ink ring-2 ring-espresso">{count}</span>}
      </button>

      {/* Tetap di DOM supaya isian ikut terkirim bersama form; disembunyikan saat tertutup */}
      <div className={`fixed inset-0 z-50 items-end justify-center text-ink md:items-center md:p-6 ${open ? "flex" : "hidden"}`}>
        <button type="button" aria-label="Tutup filter" onClick={close} className="absolute inset-0 cursor-default bg-ink/55" />
        <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
          className="relative flex max-h-[88dvh] w-full flex-col rounded-t-[2rem] bg-canvas outline-none md:max-w-lg md:rounded-[2rem]">
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
            <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line md:hidden" aria-hidden />
            <h2 id={titleId} className="mt-3 text-xl font-extrabold">Filter</h2>
            <button type="button" onClick={close} aria-label="Tutup" className="mt-2 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface">
              <Icon name="x" className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="space-y-6 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
          <div className="flex items-center gap-3 border-t border-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:pb-4">
            <Link href={resetHref} onClick={() => setOpen(false)} className="min-h-12 shrink-0 content-center px-2 text-sm font-semibold text-muted hover:text-ink">Hapus semua</Link>
            <button type="button" onClick={close} className="btn-primary min-h-12 flex-1">Lihat {total} kafe</button>
          </div>
        </div>
      </div>
    </>
  );
}
