"use client";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

/** Kembali ke halaman sebelumnya; kalau halaman dibuka langsung (dari link luar), ke `fallback`. */
export default function BackButton({ fallback, className }: { fallback: string; className?: string }) {
  const router = useRouter();
  return (
    <button type="button" aria-label="Kembali" className={className}
      onClick={() => (window.history.length > 1 && document.referrer.startsWith(location.origin) ? router.back() : router.push(fallback))}>
      <Icon name="back" className="h-5 w-5" />
    </button>
  );
}
