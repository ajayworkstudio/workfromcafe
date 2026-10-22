"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const CAFE_PAGE = /^\/kafe\/[^/?#]+$/;

/**
 * Transisi antarhalaman ala aplikasi dengan View Transitions API (Chrome, Edge, Safari 18+).
 * Klik link internal ke halaman lain dibungkus document.startViewTransition: halaman lama memudar,
 * halaman baru naik halus. Kalau link menuju halaman kafe, foto di kartu yang diklik "terbang" menjadi
 * foto besar di halaman detail (nama transisi `cafe-photo`). Browser tanpa dukungan: navigasi biasa.
 */
export default function PageTransitions() {
  const router = useRouter();
  const path = usePathname();
  const done = useRef<(() => void) | null>(null);

  // Halaman baru sudah dirender: selesaikan transisi yang sedang berjalan
  useEffect(() => { done.current?.(); done.current = null; }, [path]);

  useEffect(() => {
    if (typeof document.startViewTransition !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target || a.hasAttribute("download") || a.dataset.noTransition != null) return;
      const url = new URL(a.href, location.href);
      // Hanya pindah halaman di situs ini; ganti filter/hash di halaman yang sama tidak dianimasikan
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (url.pathname.startsWith("/api/") || /\.\w+$/.test(url.pathname)) return;

      e.preventDefault();
      e.stopPropagation(); // jangan sampai Link Next ikut menavigasi (dua kali)

      // Foto kartu yang diklik jadi pasangan foto besar di halaman kafe
      document.querySelectorAll<HTMLElement>("[data-vt-active]").forEach((el) => { el.style.viewTransitionName = ""; delete el.dataset.vtActive; });
      if (CAFE_PAGE.test(url.pathname)) {
        // Dari halaman kafe ke kafe lain: foto lama tidak boleh memakai nama yang sama dengan foto kartu
        document.querySelectorAll(".vt-cafe-photo").forEach((el) => el.classList.remove("vt-cafe-photo"));
        const img = a.querySelector("img") ?? a.closest("article")?.querySelector("img");
        if (img) { img.style.viewTransitionName = "cafe-photo"; img.dataset.vtActive = ""; }
      }

      const href = url.pathname + url.search + url.hash;
      document.startViewTransition(() => new Promise<void>((resolve) => {
        done.current = resolve;
        router.push(href);
        // Server lambat: jangan bekukan layar terlalu lama, lanjutkan tanpa menunggu
        setTimeout(resolve, 700);
      }));
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
