"use client";
import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/*
  Form filter (GET) yang langsung menerapkan pilihan tanpa tombol "Terapkan":
  - pilihan, centang, dan chip: begitu diklik
  - kolom ketik: setelah berhenti mengetik sebentar, atau saat menekan Enter
  Tanpa JavaScript, tombol Terapkan muncul lagi lewat <noscript> supaya filter tetap bisa dipakai.
*/
export default function AutoFilterForm({ children, className, delay = 450 }: { children: ReactNode; className?: string; delay?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();
  const params = useSearchParams().toString();
  // Alamat yang diminta form ini (bisa lebih dari satu kalau mengetik saat hasil sebelumnya masih dimuat)
  const requested = useRef(new Set<string>([params]));
  const latest = useRef(params);

  const apply = () => {
    const f = ref.current;
    if (!f) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const qs = new URLSearchParams();
    for (const [k, v] of new FormData(f).entries()) {
      if (typeof v === "string" && v.trim() !== "") qs.append(k, v.trim());
    }
    latest.current = qs.toString();
    requested.current.add(latest.current);
    const url = qs.size ? `${pathname}?${qs}` : pathname;
    startTransition(() => router.replace(url, { scroll: false }));
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Alamat berubah bukan dari form ini (mis. link "Hapus semua filter" atau tombol kembali):
  // kembalikan isian ke nilai dari server supaya form dan hasil selalu sama.
  useEffect(() => {
    if (!ref.current) return;
    if (params === latest.current) { requested.current = new Set([params]); return; } // permintaan terakhir form ini selesai
    if (requested.current.has(params)) return; // permintaan lama form ini, yang terbaru masih dimuat
    requested.current = new Set([params]);
    latest.current = params;
    const sp = new URLSearchParams(params);
    for (const el of Array.from(ref.current.elements) as (HTMLInputElement | HTMLSelectElement)[]) {
      if (!el.name) continue;
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) el.checked = sp.getAll(el.name).includes(el.value);
      else if (el instanceof HTMLSelectElement) { const v = sp.get(el.name); if (v != null) el.value = v; else el.selectedIndex = 0; }
      else el.value = sp.get(el.name) ?? "";
    }
  }, [params]);

  const onChange = (e: React.FormEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    const typing = (t.tagName === "INPUT" && ["text", "search"].includes(t.type)) || t.tagName === "TEXTAREA";
    if (typing) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(apply, delay);
    } else {
      apply();
    }
  };

  return (
    // Event "input" dipicu oleh ketikan, pilihan (select), dan centang, jadi satu pendengar cukup
    <form ref={ref} className={`relative ${className ?? ""}`} aria-busy={pending}
      onInput={onChange}
      onSubmit={(e) => { e.preventDefault(); apply(); }}>
      {children}
      <noscript><button className="btn-dark">Terapkan</button></noscript>
      <p role="status" aria-live="polite" className={`pointer-events-none absolute -bottom-5 left-0 text-xs text-muted transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}>
        {pending ? "Memperbarui hasil…" : ""}
      </p>
    </form>
  );
}
