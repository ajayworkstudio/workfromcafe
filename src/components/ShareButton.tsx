"use client";
import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

/*
  Tombol "Bagikan" + menu: aplikasi lain lewat menu bagikan bawaan HP (termasuk Instagram,
  yang tidak punya link bagikan untuk web), salin link, WhatsApp, Telegram, X, Facebook.
*/
export default function ShareButton({ url, title, text, align = "left", className = "btn-ghost" }: {
  url: string;
  title: string;
  /** Kalimat pembuka yang ikut terkirim bersama link (WhatsApp, Telegram, X) */
  text: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const [side, setSide] = useState<"left" | "right">(align);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => { setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function"); }, []);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>("[data-share-item]")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Cadangan untuk browser lama / konteks tanpa izin clipboard
      const ta = document.createElement("textarea");
      ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const native = async () => {
    try { await navigator.share({ title, text, url }); setOpen(false); } catch { /* dibatalkan pengguna */ }
  };

  const msg = `${text} ${url}`;
  const links = [
    { label: "WhatsApp", icon: <Icon name="whatsapp" className="h-5 w-5 text-[#128c4a]" />, href: `https://wa.me/?text=${encodeURIComponent(msg)}` },
    { label: "Telegram", icon: <Icon name="send" className="h-5 w-5 text-[#229ed9]" />, href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { label: "X (Twitter)", icon: <span aria-hidden className="grid h-5 w-5 place-items-center text-sm font-black">X</span>, href: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
    { label: "Facebook", icon: <Icon name="facebook" className="h-5 w-5 text-[#1877f2]" />, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  ];
  const item = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-tint focus-visible:bg-tint";

  return (
    <div ref={wrap} className="relative">
      <button ref={trigger} type="button" onClick={() => {
        // Buka ke arah yang masih ada ruang: tombol di separuh kiri layar membuka ke kanan, dan sebaliknya
        const r = trigger.current?.getBoundingClientRect();
        if (r) setSide(r.left + r.width / 2 < window.innerWidth / 2 ? "left" : "right");
        setOpen((o) => !o);
      }} aria-expanded={open} aria-controls={menuId} className={className}>
        <Icon name="share" className="h-4 w-4" />Bagikan
      </button>
      {open && (
        <div id={menuId} role="dialog" aria-label={`Bagikan ${title}`}
          className={`absolute top-full z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-20px_rgba(31,22,18,.45)] ${side === "right" ? "right-0" : "left-0"}`}>
          {canNative && (
            <button type="button" data-share-item onClick={native} className={item}>
              <Icon name="instagram" className="h-5 w-5 text-[#c13584]" />Instagram &amp; aplikasi lain
            </button>
          )}
          <button type="button" data-share-item onClick={copy} className={item}>
            <Icon name={copied ? "check" : "link"} className={`h-5 w-5 ${copied ? "text-[#2f7049]" : ""}`} />
            {copied ? "Link disalin" : "Salin link"}
          </button>
          <span role="status" aria-live="polite" className="sr-only">{copied ? "Link sudah disalin" : ""}</span>
          <div className="my-1 h-px bg-line" />
          {links.map((l) => (
            <a key={l.label} data-share-item href={l.href} target="_blank" rel="noopener" onClick={() => setOpen(false)} className={item}>
              {l.icon}{l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
