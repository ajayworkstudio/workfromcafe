"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Icon from "./Icon";

type Tab = { key: string; label: string; icon: string; note: string; href: string; allLabel: string; panel: ReactNode };

/** "Cocok untuk" di beranda: pil WFC / Nongkrong, isi tiap pil sudah dirender di server. */
export default function CategoryTabs({ title, tabs }: { title: string; tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const cur = tabs[active];

  // Panah kiri/kanan pindah pil, sesuai pola tab ARIA
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 id="cocok-untuk" className="text-2xl font-bold md:text-4xl md:font-extrabold">{title}</h2>
        <div role="tablist" aria-labelledby="cocok-untuk" className="flex rounded-full border border-line bg-surface p-1">
          {tabs.map((tab, i) => {
            const on = i === active;
            return (
              <button key={tab.key} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`tab-${tab.key}`}
                aria-selected={on} aria-controls={`panel-${tab.key}`} tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)} onKeyDown={(e) => onKey(e, i)}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors md:px-5 md:text-base ${on ? "bg-espresso text-foam" : "text-muted hover:text-ink"}`}>
                <Icon name={tab.icon} className="h-4 w-4 md:h-5 md:w-5" />{tab.label}
              </button>
            );
          })}
        </div>
        <Link href={cur.href} className="ml-auto shrink-0 py-2 text-sm font-semibold text-brand hover:underline max-sm:hidden">{cur.allLabel}</Link>
      </div>
      <p className="mt-2 text-sm text-muted">{cur.note}</p>

      {tabs.map((tab, i) => (
        <div key={tab.key} role="tabpanel" id={`panel-${tab.key}`} aria-labelledby={`tab-${tab.key}`} hidden={i !== active}>
          {tab.panel}
        </div>
      ))}
      <Link href={cur.href} className="btn-ghost mt-4 min-h-11 w-full sm:hidden">{cur.allLabel}</Link>
    </div>
  );
}
