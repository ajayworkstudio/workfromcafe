"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32, maxWidth: 560, margin: "0 auto", textAlign: "center", lineHeight: 1.6 }}>
        <h1>Halaman gagal dimuat</h1>
        <p>Ada gangguan di server. Coba muat ulang.</p>
        {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#6f625a" }}>Kode: {error.digest}</p>}
        <button onClick={reset} style={{ padding: "10px 20px", borderRadius: 999, border: 0, background: "#1f1612", color: "#fff", cursor: "pointer" }}>Muat ulang</button>
      </body>
    </html>
  );
}
