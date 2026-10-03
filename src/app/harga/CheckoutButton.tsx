"use client";
import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/types";

type SnapCallbacks = { onSuccess?: () => void; onPending?: () => void; onError?: () => void; onClose?: () => void };
declare global {
  interface Window { snap?: { pay: (token: string, cb: SnapCallbacks) => void } }
}

export default function CheckoutButton({ plan, snapJs, clientKey, highlight }: { plan: Plan; snapJs: string; clientKey: string; highlight?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function pay() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/midtrans/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memulai pembayaran");
      if (window.snap) {
        window.snap.pay(json.token, {
          onSuccess: () => router.push("/akun?bayar=selesai"),
          onPending: () => router.push("/akun?bayar=selesai"),
          onError: () => setErr("Pembayaran gagal, coba lagi."),
        });
      } else {
        window.location.href = json.redirect_url; // fallback halaman Midtrans
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script src={snapJs} data-client-key={clientKey} strategy="lazyOnload" />
      <button onClick={pay} disabled={loading} className={`${highlight ? "btn-primary" : "btn-dark"} w-full`}>
        {loading ? "Menyiapkan pembayaran…" : "Langganan sekarang"}
      </button>
      {err && <p className="mt-2 text-sm text-terra-dark">{err}</p>}
    </>
  );
}
