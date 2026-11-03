"use client";
import { useEffect } from "react";

/**
 * Mencatat kunjungan halaman kafe dan klik tombol bertanda data-track="maps|menu|instagram|share|whatsapp".
 * Asal kunjungan: kalau halaman ini yang pertama dibuka di tab ini, pakai document.referrer;
 * kalau datang dari halaman lain di WFC Hunters (navigasi di dalam aplikasi), referrer-nya situs ini sendiri.
 */
export default function CafeTracker({ cafeId }: { cafeId: string }) {
  useEffect(() => {
    const send = (kind: string) => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const landed = !nav || new URL(nav.name).pathname === location.pathname;
      const payload = JSON.stringify({
        cafe_id: cafeId,
        kind,
        ref: landed ? document.referrer : location.origin + "/",
        utm: new URLSearchParams(location.search).get("utm_source") ?? "",
      });
      try {
        if (!navigator.sendBeacon?.("/api/lihat", new Blob([payload], { type: "application/json" }))) {
          fetch("/api/lihat", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
        }
      } catch { /* pencatatan tidak boleh mengganggu */ }
    };

    // Tab yang dibuka di latar belakang belum dihitung sampai benar-benar dilihat
    let viewed = false;
    const view = () => { if (!viewed && document.visibilityState === "visible") { viewed = true; send("view"); } };
    view();
    document.addEventListener("visibilitychange", view);

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-track]") as HTMLElement | null;
      if (el?.dataset.track) send(el.dataset.track);
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("visibilitychange", view); document.removeEventListener("click", onClick, true); };
  }, [cafeId]);
  return null;
}
