"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const EVERY = 60_000;

function send(path: string, leave = false) {
  const body = JSON.stringify({ path, leave });
  if (!navigator.sendBeacon?.("/api/online", new Blob([body], { type: "application/json" }))) {
    fetch("/api/online", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

/** Kirim sinyal online ke server tiap 1 menit selama tab terlihat, saat pindah halaman, dan saat tab ditutup. */
export default function PresencePing() {
  const path = usePathname();
  useEffect(() => {
    if (document.visibilityState === "visible") send(path);
    const id = window.setInterval(() => { if (document.visibilityState === "visible") send(path); }, EVERY);
    const onVis = () => { if (document.visibilityState === "visible") send(path); };
    const onHide = () => send(path, true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onHide); };
  }, [path]);
  return null;
}
