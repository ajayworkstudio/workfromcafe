"use client";
import { useState } from "react";

/** Pilih nominal isi saldo, lalu buka WhatsApp dengan pesan yang sudah terisi. */
export default function TopupBox({ wa, cafeName, email }: { wa: string; cafeName: string; email: string }) {
  const [amount, setAmount] = useState("");
  const n = Number(amount.replace(/\D/g, "")) || 0;
  const text = [
    `Halo, saya mau isi saldo iklan WFC Hunters.`,
    ``,
    `Kafe: ${cafeName}`,
    `Nominal: Rp${n.toLocaleString("id-ID")}`,
    `Email akun: ${email}`,
    ``,
    `Bukti transfer QRIS saya lampirkan.`,
  ].join("\n");
  const href = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="topup" className="label">Nominal yang kamu transfer</label>
        <input id="topup" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="50000" className="input" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[50000, 100000, 250000].map((v) => (
          <button key={v} type="button" onClick={() => setAmount(String(v))}
            className={`btn-ghost min-h-11 !px-3 text-sm ${n === v ? "!border-brand text-brand" : ""}`}>
            Rp{v.toLocaleString("id-ID")}
          </button>
        ))}
      </div>
      {n > 0 ? (
        <a href={href} target="_blank" rel="noopener" className="btn w-full bg-[#1f8f4e] text-white hover:bg-[#187540]">
          Konfirmasi Rp{n.toLocaleString("id-ID")} via WhatsApp
        </a>
      ) : (
        <p className="text-sm text-muted">Isi nominal dulu, lalu tombol konfirmasi WhatsApp muncul di sini.</p>
      )}
    </div>
  );
}
