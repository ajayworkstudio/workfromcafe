"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Halaman gagal dimuat</h1>
      <p className="mt-2 text-muted">Ada gangguan sesaat. Coba muat ulang. Kalau masih terjadi, kabari kami.</p>
      {error.digest && <p className="mt-3 font-mono text-xs text-muted">Kode: {error.digest}</p>}
      <button onClick={reset} className="btn-dark mt-6">Muat ulang</button>
    </div>
  );
}
