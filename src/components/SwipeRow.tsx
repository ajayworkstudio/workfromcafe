"use client";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";

/*
  Deretan kartu yang bisa digeser (swipe) ke samping.
  - HP/tablet: geser dengan jari, tiap kartu berhenti pas di tepi (scroll-snap).
  - Laptop: tombol kiri/kanan, trackpad, atau tarik dengan mouse.
  - Saat pertama terlihat, kartu masuk berurutan dari kanan lalu deret sedikit "mengintip" ke kanan
    sekali, memberi tanda bahwa isinya bisa digeser. Dimatikan untuk "kurangi gerakan".
*/
export default function SwipeRow({ children, label }: { children: ReactNode; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const items = Children.toArray(children);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>("[data-swipe-item]");
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: "smooth" });
  };

  // Tarik dengan mouse (sentuhan sudah ditangani browser)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let down = false, moved = false, startX = 0, startLeft = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) { moved = true; el.style.scrollSnapType = "none"; el.setPointerCapture(e.pointerId); }
      if (moved) el.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      if (moved) {
        el.style.scrollSnapType = "";
        // cegah klik link setelah menarik
        el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
      }
    };
    const noDrag = (e: DragEvent) => e.preventDefault(); // link & foto jangan ikut terseret
    el.addEventListener("dragstart", noDrag);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      el.removeEventListener("dragstart", noDrag);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  // Animasi masuk + isyarat geser
  useEffect(() => {
    let revert: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      const el = track.current;
      if (cancelled || !el) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const cards = el.querySelectorAll<HTMLElement>("[data-swipe-item]");
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } });
        tl.from(cards, { x: 120, opacity: 0, rotate: 2, duration: 0.7, ease: "power3.out", stagger: 0.08 });
        if (el.scrollWidth > el.clientWidth + 8) {
          tl.to(el, { scrollLeft: 64, duration: 0.45, ease: "power2.out" }, "+=0.15")
            .to(el, { scrollLeft: 0, duration: 0.5, ease: "power2.inOut" });
        }
      });
      revert = () => mm.revert();
    })();
    return () => { cancelled = true; revert?.(); };
  }, []);

  return (
    <div className="relative">
      <div ref={track} role="region" aria-label={label} tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 [scrollbar-width:none] md:gap-5 [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing">
        {items.map((child, i) => (
          <div key={i} data-swipe-item className="w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-[31.5%]">
            {child}
          </div>
        ))}
      </div>
      <div className="mt-2 hidden justify-end gap-2 md:flex">
        <button type="button" onClick={() => step(-1)} disabled={edge.start} aria-label="Kafe sebelumnya"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface transition-colors hover:border-brand disabled:opacity-40 disabled:hover:border-line">
          <Icon name="chevron" className="h-5 w-5 rotate-180" />
        </button>
        <button type="button" onClick={() => step(1)} disabled={edge.end} aria-label="Kafe berikutnya"
          className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface transition-colors hover:border-brand disabled:opacity-40 disabled:hover:border-line">
          <Icon name="chevron" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
