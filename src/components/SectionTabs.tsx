"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Tab pil di halaman kafe (HP). Bukan tab yang menyembunyikan isi: semua bagian tetap satu halaman,
 * tab hanya melompat ke bagiannya dan menandai bagian yang sedang dibaca.
 */
export default function SectionTabs({ tabs }: { tabs: { id: string; label: string }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = tabs.map((t) => document.getElementById(t.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (seen) setActive(seen.target.id);
    }, { rootMargin: "-130px 0px -55% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [tabs]);

  // Tab yang aktif digeser supaya tetap terlihat di bilah
  useEffect(() => {
    const b = bar.current;
    const el = b?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    // Hanya geser bilahnya ke samping (scrollIntoView bisa ikut menggeser halaman)
    if (b && el) b.scrollTo({ left: el.offsetLeft - (b.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  if (tabs.length < 2) return null;
  return (
    <div className="sticky top-16 z-20 -mx-4 mt-4 bg-canvas/95 px-4 py-2 backdrop-blur md:hidden">
      <div ref={bar} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {tabs.map((t) => (
          <a key={t.id} href={`#${t.id}`} data-tab={t.id} aria-current={active === t.id ? "location" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
              active === t.id ? "bg-ink text-white" : "border border-line bg-surface text-ink/80"
            }`}>
            {t.label}
          </a>
        ))}
      </div>
    </div>
  );
}
