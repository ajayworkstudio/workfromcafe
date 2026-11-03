"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Gulir ke pesan terbaru dan ambil pesan baru tiap 20 detik selama tab terlihat. */
export default function ChatAutoScroll() {
  const router = useRouter();
  useEffect(() => {
    const el = document.getElementById("chat-log");
    if (el) el.scrollTop = el.scrollHeight;
  });
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible" && !document.activeElement?.matches("textarea")) router.refresh(); }, 20000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
